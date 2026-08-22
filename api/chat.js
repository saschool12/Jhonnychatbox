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
    
    // Try NVIDIA key first, then OpenRouter as fallback
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    
    if (!nvidiaKey && !openRouterKey) {
      throw new Error('No API key found – set NVIDIA_API_KEY or OPENROUTER_API_KEY');
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

      // 📄 For other files, just mention the name (we'll add parsing later)
      else {
        const lastIndex = finalMessages.length - 1;
        if (finalMessages[lastIndex]?.role === 'user') {
          finalMessages[lastIndex].content += `\n\n[Uploaded file: ${filename}]`;
        }
      }
    }

    // ─── Choose API to call ──────────────────────────────
    // Prefer NVIDIA if key exists, else fallback to OpenRouter
    let response;
    let usedApi = '';

    try {
      if (nvidiaKey) {
        // Try NVIDIA NIM endpoint
        const model = isImage ? 'nvidia/neva-22b' : 'mistralai/mistral-7b-instruct-v0.2';
        
        response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${nvidiaKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: finalMessages,
            max_tokens: 500,
            temperature: 0.7
          })
        });

        if (response.ok) {
          usedApi = 'NVIDIA';
        } else {
          // If NVIDIA fails (e.g., 404), fallback to OpenRouter
          throw new Error(`NVIDIA API error: ${response.status} - ${await response.text()}`);
        }
      }
    } catch (nvidiaErr) {
      // Fallback to OpenRouter
      console.warn('NVIDIA failed, using OpenRouter:', nvidiaErr.message);
      if (!openRouterKey) {
        throw new Error('NVIDIA failed and no OpenRouter key available');
      }

      const model = isImage ? 'openai/gpt-4o' : 'openai/gpt-3.5-turbo';
      
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
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

      usedApi = 'OpenRouter';
    }

    // If response is still not defined (e.g., both failed), throw error
    if (!response) {
      throw new Error('Both NVIDIA and OpenRouter failed');
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`${usedApi} API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
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
