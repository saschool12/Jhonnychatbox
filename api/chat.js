import Busboy from 'busboy';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the multipart form data
    const { messagesJson } = await parseMultipart(req);

    if (!messagesJson) {
      throw new Error('Missing messages field');
    }

    const messages = JSON.parse(messagesJson);

    // 🔥 CALL OPENAI – replace the dummy reply
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 500
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI error: ${openaiResponse.status} - ${errorText}`);
    }

    const data = await openaiResponse.json();
    const reply = data.choices[0].message.content;

    // Send the AI reply back
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const fields = {};

    busboy.on('field', (fieldname, val) => {
      fields[fieldname] = val;
    });

    busboy.on('finish', () => {
      resolve({ messagesJson: fields.messages });
    });

    busboy.on('error', reject);
    req.pipe(busboy);
  });
}
