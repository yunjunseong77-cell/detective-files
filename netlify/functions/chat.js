const https = require('https');

function httpsPost(url, data, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { history, answer } = JSON.parse(event.body);
    const API_KEY = process.env.OPENAI_API_KEY;

    const systemPrompt = `당신은 범죄 수사 퀴즈 게임의 냉철한 심문관입니다.

[이 사건의 정답]
${answer}

[규칙]
1. 반드시 [예] 또는 [아니오] 로만 시작하세요. 필요시 [부분적으로] 가능.
2. 정답을 직접 알려주지 마세요.
3. 1~2문장으로 짧고 건조하게 답하세요.
4. 플레이어가 사건의 핵심 전말을 완전히 정확하게 설명했을 때만 "CASE CLOSED"를 포함하세요.
5. 반드시 한국어로 답하세요.`;

    const messages = [{ role: 'system', content: systemPrompt }];
    for (const h of history) {
      if (h.role === 'user') {
        messages.push({ role: 'user', content: h.parts[0].text });
      } else if (h.role === 'model') {
        messages.push({ role: 'assistant', content: h.parts[0].text });
      }
    }

    const data = await httpsPost(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        max_tokens: 300,
        temperature: 0.7
      },
      API_KEY
    );

    const reply = data.choices?.[0]?.message?.content || '오류가 발생했습니다.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
