import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET;
import Busboy from 'busboy';

export default async function handler(req, res) {
  // Health check (GET)
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', message: 'API is alive' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ─── Parse multipart ──────────────────────────────────────────
    const { messagesJson, fileBuffer, fileInfo } = await parseMultipart(req);

    if (!messagesJson) {
      return res.status(400).json({ error: 'Missing messages field' });
    }

    // ─── API key ──────────────────────────────────────────────────
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing OPENROUTER_API_KEY environment variable' });
    }

    // ─── Parse messages ──────────────────────────────────────────
    const messages = JSON.parse(messagesJson);
    let finalMessages = messages;
    let isImage = false;

    // ─── Process uploaded file ──────────────────────────────────
    if (fileBuffer && fileInfo) {
      const { filename, mimeType } = fileInfo;

      // ─── IMAGE ──────────────────────────────────────────────────
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

      // ─── PDF ────────────────────────────────────────────────────
      else if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
        try {
          const pdfParse = await import('pdf-parse');
          const pdfData = await pdfParse.default(fileBuffer);
          const extracted = pdfData.text.slice(0, 3000);
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[PDF Content]:\n${extracted}`;
          }
        } catch (err) {
          console.warn('PDF parse skipped:', err.message);
        }
      }

      // ─── Word (.docx) ──────────────────────────────────────────
      else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        filename.endsWith('.docx')
      ) {
        try {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          const extracted = result.value.slice(0, 3000);
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[Word Content]:\n${extracted}`;
          }
        } catch (err) {
          console.warn('DOCX parse skipped:', err.message);
        }
      }

      // ─── Excel (.xlsx, .xls) ──────────────────────────────────
      else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel' ||
        filename.endsWith('.xlsx') ||
        filename.endsWith('.xls')
      ) {
        try {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
          let sheetText = '';
          workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet);
            sheetText += `\n[Sheet: ${sheetName}]\n${JSON.stringify(json, null, 2).slice(0, 1000)}`;
          });
          const extracted = sheetText.slice(0, 3000);
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[Excel Content]:\n${extracted}`;
          }
        } catch (err) {
          console.warn('Excel parse skipped:', err.message);
        }
      }

      // ─── Plain text files ──────────────────────────────────────
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

      // ─── Any other file ────────────────────────────────────────
      else {
        const lastIndex = finalMessages.length - 1;
        if (finalMessages[lastIndex]?.role === 'user') {
          finalMessages[lastIndex].content += `\n\n[Uploaded file: ${filename}]`;
        }
      }
    }

    // ─── Choose model ──────────────────────────────────────────
    const model = isImage ? 'openai/gpt-4o' : 'openai/gpt-3.5-turbo';

    // ─── Call OpenRouter ──────────────────────────────────────
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
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'No response received.';

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}

// ─── Helper: parse multipart/form-data ────────────────────────────
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
