import Busboy from 'busboy';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messagesJson, fileBuffer, fileInfo } = await parseMultipart(req);
    if (!messagesJson) throw new Error('Missing messages field');
    const messages = JSON.parse(messagesJson);

    // ─── Read environment variables ──────────────────────────
    const geminiKey = process.env.GEMINI_API_KEY;
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const provider = (process.env.API_PROVIDER || '').toLowerCase();

    let apiProvider;
    if (provider) {
      apiProvider = provider;
    } else {
      if (geminiKey) apiProvider = 'gemini';
      else if (nvidiaKey) apiProvider = 'nvidia';
      else if (openRouterKey) apiProvider = 'openrouter';
      else throw new Error('No API key found – set one of GEMINI_API_KEY, NVIDIA_API_KEY, or OPENROUTER_API_KEY');
    }

    // ─── Process uploaded file ──────────────────────────────
    let isImage = false;
    let finalMessages = messages;
    let imageBase64 = null;
    let imageMime = null;

    if (fileBuffer && fileInfo) {
      const { filename, mimeType } = fileInfo;

      // 🔹 IMAGE
      if (mimeType.startsWith('image/')) {
        isImage = true;
        imageBase64 = fileBuffer.toString('base64');
        imageMime = mimeType;
        const lastUserMsg = messages.filter(m => m.role === 'user').pop();
        const userText = lastUserMsg ? lastUserMsg.content : 'Analyze this image.';

        // For Gemini we handle differently; for OpenAI‑compatible we use image_url
        if (apiProvider === 'gemini') {
          finalMessages = messages; // Gemini gets image separately
        } else {
          finalMessages = [
            ...messages.slice(0, -1),
            {
              role: 'user',
              content: [
                { type: 'text', text: userText },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
              ]
            }
          ];
        }
      }

      // 🔹 PDF
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
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[Uploaded PDF: ${filename}] (text extraction unavailable)`;
          }
        }
      }

      // 🔹 Word (.docx)
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
            finalMessages[lastIndex].content += `\n\n[Word Document Content]:\n${extracted}`;
          }
        } catch (err) {
          console.warn('DOCX parse skipped:', err.message);
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[Uploaded Word document: ${filename}]`;
          }
        }
      }

      // 🔹 Excel (.xlsx, .xls)
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
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet);
            sheetText += `\n[Sheet: ${sheetName}]\n${JSON.stringify(json, null, 2).slice(0, 1000)}\n`;
          });
          const extracted = sheetText.slice(0, 3000);
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[Excel Content]:\n${extracted}`;
          }
        } catch (err) {
          console.warn('Excel parse skipped:', err.message);
          const lastIndex = finalMessages.length - 1;
          if (finalMessages[lastIndex]?.role === 'user') {
            finalMessages[lastIndex].content += `\n\n[Uploaded Excel file: ${filename}]`;
          }
        }
      }

      // 🔹 Plain text files (.txt, .csv, .json, .md)
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

      // 🔹 Any other file – just mention the name
      else {
        const lastIndex = finalMessages.length - 1;
        if (finalMessages[lastIndex]?.role === 'user') {
          finalMessages[lastIndex].content += `\n\n[Uploaded file: ${filename}]`;
        }
      }
    }

    // ─── Call the appropriate API ──────────────────────────
    let reply;

    if (apiProvider === 'gemini') {
      reply = await callGemini(geminiKey, finalMessages, isImage, imageBase64, imageMime);
    } else if (apiProvider === 'nvidia') {
      reply = await callNVIDIA(nvidiaKey, finalMessages, isImage);
    } else if (apiProvider === 'openrouter') {
      reply = await callOpenRouter(openRouterKey, finalMessages, isImage);
    } else {
      throw new Error(`Unsupported provider: ${apiProvider}`);
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}

// ─── Gemini API ──────────────────────────────────────────────
async function callGemini(apiKey, messages, isImage, imageBase64, imageMime) {
  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  let finalContents = contents;

  if (isImage && imageBase64) {
    const lastUserMsg = contents.filter(c => c.role === 'user').pop();
    const text = lastUserMsg?.parts?.[0]?.text || 'Analyze this image.';
    finalContents = [
      ...contents.slice(0, -1),
      {
        role: 'user',
        parts: [
          { text: text },
          { inline_data: { mime_type: imageMime, data: imageBase64 } }
        ]
      }
    ];
  }

  const model = isImage ? 'gemini-1.5-flash' : 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: finalContents,
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
}

// ─── NVIDIA NIM ─────────────────────────────────────────────
async function callNVIDIA(apiKey, messages, isImage) {
  const model = isImage ? 'nvidia/neva-22b' : 'mistralai/mistral-7b-instruct-v0.2';
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`NVIDIA API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── OpenRouter ──────────────────────────────────────────────
async function callOpenRouter(apiKey, messages, isImage) {
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
      messages: messages,
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── Helper: parse multipart/form-data ────────────────────
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
