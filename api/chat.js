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
      else throw new Error('No API key found');
    }

    // ─── Process uploaded file ──────────────────────────────
    let isImage = false;
    let finalMessages = messages;
    let imageBase64 = null;
    let imageMime = null;

    if (fileBuffer && fileInfo) {
      const { filename, mimeType } = fileInfo;

      if (mimeType.startsWith('image/')) {
        isImage = true;
        imageBase64 = fileBuffer.toString('base64');
        imageMime = mimeType;
        const lastUserMsg = messages.filter(m => m.role === 'user').pop();
        const userText = lastUserMsg ? lastUserMsg.content : 'Analyze this image.';

        if (apiProvider === 'gemini') {
          // Keep messages plain for Gemini – we add image later in callGemini()
          finalMessages = messages;
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
      } else {
        // Non‑image files – extract content if possible
        const fileContent = await extractFileContent(fileBuffer, filename, mimeType);
        const lastIndex = finalMessages.length - 1;
        if (finalMessages[lastIndex]?.role === 'user') {
          finalMessages[lastIndex].content += fileContent;
        }
      }
    }

    // ─── Call API with fallback ──────────────────────────────
    let reply;
    let usedProvider = apiProvider;

    try {
      if (apiProvider === 'gemini') {
        reply = await callGemini(geminiKey, finalMessages, isImage, imageBase64, imageMime);
      } else if (apiProvider === 'nvidia') {
        reply = await callNVIDIA(nvidiaKey, finalMessages, isImage);
      } else if (apiProvider === 'openrouter') {
        reply = await callOpenRouter(openRouterKey, finalMessages, isImage);
      } else {
        throw new Error(`Unsupported provider: ${apiProvider}`);
      }
    } catch (err) {
      // ─── Fallback to OpenRouter if available ───────────────
      console.warn(`Provider ${apiProvider} failed:`, err.message);
      if (openRouterKey && apiProvider !== 'openrouter') {
        console.warn('Falling back to OpenRouter...');
        usedProvider = 'openrouter (fallback)';
        reply = await callOpenRouter(openRouterKey, finalMessages, isImage);
      } else {
        throw err;
      }
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}

// ─── Gemini API (correct model names) ───────────────────────
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

  // Use the correct model name – gemini-1.5-flash supports both text and vision
  const model = 'gemini-1.5-flash';
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

// ─── NVIDIA NIM ──────────────────────────────────────────────
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

// ─── Extract text from various file types ──────────────────
async function extractFileContent(buffer, filename, mimeType) {
  let content = `\n\n[Uploaded file: ${filename}]`;
  try {
    if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
      const pdfParse = await import('pdf-parse');
      const pdfData = await pdfParse.default(buffer);
      content = `\n\n[PDF Content]:\n${pdfData.text.slice(0, 3000)}`;
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      filename.endsWith('.docx')
    ) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      content = `\n\n[Word Document Content]:\n${result.value.slice(0, 3000)}`;
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      filename.endsWith('.xlsx') ||
      filename.endsWith('.xls')
    ) {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let sheetText = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        sheetText += `\n[Sheet: ${sheetName}]\n${JSON.stringify(json, null, 2).slice(0, 1000)}\n`;
      });
      content = `\n\n[Excel Content]:\n${sheetText.slice(0, 3000)}`;
    } else if (
      mimeType === 'text/plain' ||
      filename.endsWith('.txt') ||
      filename.endsWith('.csv') ||
      filename.endsWith('.json') ||
      filename.endsWith('.md')
    ) {
      content = `\n\n[File: ${filename}]\n${buffer.toString('utf-8').slice(0, 3000)}`;
    }
  } catch (e) {
    console.warn('File parse warning:', e.message);
  }
  return content;
}

// ─── Helper: parse multipart/form-data ──────────────────────
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
