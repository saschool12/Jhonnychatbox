import Busboy from 'busboy';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messagesJson } = await parseMultipart(req);

    if (!messagesJson) {
      throw new Error('Missing messages field');
    }

    const messages = JSON.parse(messagesJson);
    const lastMessage = messages[messages.length - 1]?.content || "nothing";

    // 🔥 REPLACE THIS DUMMY REPLY with your real AI call later
    const reply = "✅ Server got: " + lastMessage;

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
}                "Something went wrong."

        });

    }

}
