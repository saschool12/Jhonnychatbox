export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, size = '1024x1024' } = req.body;
    if (!prompt) {
      throw new Error('Missing prompt');
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      throw new Error('Missing NVIDIA_API_KEY');
    }

    const response = await fetch('https://integrate.api.nvidia.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'nvidia/flux.1-dev', // or 'nvidia/flux.1-schnell' for faster
        prompt: prompt,
        n: 1,
        size: size
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Image generation error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return res.status(200).json({ imageUrl: data.data[0].url });

  } catch (error) {
    console.error('Generate error:', error);
    return res.status(500).json({ error: error.message });
  }
}
