import Busboy from 'busboy';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messagesJson, fileBuffer, fileInfo } = await parseMultipart(req);

    if (!messagesJson) {
      throw new Error('Missing messages field');
    }

    const messages = JSON.parse(messagesJson);
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY');
    }

    let finalMessages = messages;
    let isImage = false;

    // ─── Process the uploaded file ─────────────────────────────────────────────
    if (fileBuffer && fileInfo) {
      const { filename, mimeType } = fileInfo;

      // 1️⃣ IMAGE → use vision model
      if (mimeType.startsWith('image/')) {
        isImage = true;
        const base64Image = fileBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64Image}`;
        const lastUserMsg = messages.filter(m => m.role === 'user').pop();
        const userText = lastUserMsg ? lastUserMsg.content : 'Analyze this image.';

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

      // 2️⃣ PDF → extract text (with dynamic import)
      else if (mimeType === 'application/pdf') {
        try {
          const pdfParse = await import('pdf-parse');
          const pdfData = await pdfParse.default(fileBuffer);
          const extractedText = pdfData.text.slice(0, 3000); // limit to 3000 chars

          // Append extracted text to the last user message
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[PDF Content]:\n${extractedText}`;
          }
        } catch (pdfErr) {
          console.error('PDF parse error:', pdfErr);
          // If parsing fails, still let the AI know the file name
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[PDF file: ${filename}] (could not extract text)`;
          }
        }
      }

      // 3️⃣ Text files (.txt, .csv, .json, .md) → read as string
      else if (
        mimeType === 'text/plain' ||
        filename.endsWith('.txt') ||
        filename.endsWith('.csv') ||
        filename.endsWith('.json') ||
        filename.endsWith('.md')
      ) {
        const fileText = fileBuffer.toString('utf-8').slice(0, 3000);
        const lastIndex = finalMessages.length - 1;
        if (finalMessages[lastIndex]?.role === 'user') {
          finalMessages[lastIndex].content += `\n\n[File: ${filename}]\n${fileText}`;
        }
      }

      // 4️⃣ Other files (DOCX, etc.) → just mention the file name
      else {
        const lastIndex = finalMessages.length - 1;
        if (finalMessages[lastIndex]?.role === 'user') {
          finalMessages[lastIndex].content += `\n\n[Uploaded file: ${filename}]`;
        }
      }
    }

    // ─── Call OpenRouter ──────────────────────────────────────────────────────
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

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
      details: error.stack || 'No stack trace'
    });
  }
}

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
      resolve({ messagesJson: fields.messages, fileBuffer, fileInfo });
    });

    busboy.on('error', reject);
    req.pipe(busboy);
  });
}
