import Busboy from 'busboy';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the multipart form data
    const { messagesJson, fileBuffer, fileInfo } = await parseMultipart(req);

    // Validate messages
    if (!messagesJson) {
      throw new Error('Missing messages field');
    }

    const messages = JSON.parse(messagesJson);
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY environment variable');
    }

    let finalMessages = messages;
    let isImage = false;

    // ─── Process uploaded file ──────────────────────────────
    if (fileBuffer && fileInfo) {
      const { filename, mimeType } = fileInfo;

      // ✅ IMAGE → use vision model
      if (mimeType.startsWith('image/')) {
        isImage = true;
        const base64Image = fileBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        // Get the last user message
        const lastUserMsg = messages.filter(m => m.role === 'user').pop();
        const userText = lastUserMsg ? lastUserMsg.content : 'Analyze this image.';

        // Build vision request
        finalMessages = [
          ...messages.slice(0, -1),
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ];
      }

      // 📄 For any other file type (PDF, DOCX, TXT, etc.)
      // Just mention the file name – no external parsers needed
      else {
        const lastIndex = finalMessages.length - 1;
        if (finalMessages[lastIndex]?.role === 'user') {
          finalMessages[lastIndex].content += `\n\n[Uploaded file: ${filename}]`;
        }
      }
    }

    // ─── Call OpenRouter ──────────────────────────────────
    const model = isImage ? 'openai/gpt-4o' : 'openai/gpt-3.5-turbo';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://jhonnychatbox.vercel.app',
        'X-Title': 'Jhonny Chatbox'
      },
      body: JSON.stringify({
        model: model,
        messages: finalMessages,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    // Send reply back to client
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Server error:', error);

    // ✅ Always return JSON – prevents FUNCTION_INVOCATION_FAILED
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}

// ─── Helper: Parse multipart/form-data ──────────────────
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const fields = {};
    let fileBuffer = null;
    let fileInfo = null;

    busboy.on('field', (fieldname, val) => {
      fields[fieldname] = val;
    });

    busboy.on('file', (fieldname, file, info) => {
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
        fileInfo = info;
      });
    });

    busboy.on('finish', () => {
      resolve({
        messagesJson: fields.messages,
        fileBuffer,
        fileInfo
      });
    });

    busboy.on('error', reject);
    req.pipe(busboy);
  });
}
