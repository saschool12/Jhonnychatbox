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

    if (fileBuffer && fileInfo) {
      const { filename, mimeType } = fileInfo;

      // ─── IMAGE ──────────────────────────────────────────────
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

      // ─── PDF ──────────────────────────────────────────────
      else if (mimeType === 'application/pdf') {
        try {
          // Try to import pdf-parse dynamically
          const pdfParse = await import('pdf-parse');
          const pdfData = await pdfParse.default(fileBuffer);
          const extractedText = pdfData.text.slice(0, 3000);
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[PDF Content]:\n${extractedText}`;
          }
        } catch (err) {
          console.warn('PDF parsing skipped:', err.message);
          // Just mention the file name
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[Uploaded PDF: ${filename}] (text extraction unavailable)`;
          }
        }
      }

      // ─── DOCX (Word) ──────────────────────────────────────
      else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        filename.endsWith('.docx')
      ) {
        try {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          const extractedText = result.value.slice(0, 3000);
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[Word Document Content]:\n${extractedText}`;
          }
        } catch (err) {
          console.warn('DOCX parsing skipped:', err.message);
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[Uploaded Word document: ${filename}] (text extraction unavailable)`;
          }
        }
      }

      // ─── Plain text files ────────────────────────────────
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

      // ─── Other files ────────────────────────────────────
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

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Server error:', error);
    // ✅ Always return a JSON – this prevents FUNCTION_INVOCATION_FAILED
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
}    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
}        messages: finalMessages,
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
