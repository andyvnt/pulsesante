// ============================================================
// 🔒 FONCTION NETLIFY — Login (Admin)
// ============================================================

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event, context) => {
  // ✅ Gestion du preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Seules les requêtes POST sont acceptées
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    // Récupérer les credentials depuis le body
    const { username, password } = JSON.parse(event.body) || {};

    // Valider les entrées
    if (!username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Username and password required' }),
      };
    }

    // 🔑 Vérifier les credentials (à adapter avec votre système d'auth)
    // Pour le développement : admin / pulse2024
    const ADMIN_USER = process.env.ADMIN_USER || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pulse2024';

    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      // ✅ Login réussi — générer un token
      const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          token,
          message: 'Login successful',
        }),
      };
    } else {
      // ❌ Login échoué
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid credentials' }),
      };
    }
  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
