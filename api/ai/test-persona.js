import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.warn('Missing Anthropic API key - using mock response for persona test');
    const mockGreetings = {
      professional: "Good morning! Ready to tackle today's schedule efficiently.",
      coach: "You've got this, superstar! Let's make today your best one yet!",
      casual: "Hey there! Ready to head out and do some great work today?",
    };
    return res.status(200).json({ message: mockGreetings[req.body.style || 'professional'] || mockGreetings.professional });
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const { style, ownerName } = req.body;

  try {
    const prompt = `You are an AI assistant for ${ownerName || 'a business owner'}. 
    Write a single, short, quirky 1-sentence greeting using a "${style || 'professional'}" tone to start the day. 
    Be concise. No intro/outro.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    });

    const message = response.content[0].text;
    return res.status(200).json({ message });
  } catch (error) {
    console.error('AI Test Persona Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
