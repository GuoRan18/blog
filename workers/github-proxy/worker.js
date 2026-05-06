// GitHub API 代理 + 又拍云 S3 API 图片上传 Worker
// 部署到 Cloudflare Workers

export default {
  async fetch(request, env) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, x-target-url',
        },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ========== 验证密钥 ==========
    const adminToken = request.headers.get('x-admin-token') || '';
    if (adminToken !== env.ADMIN_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders(),
      });
    }

    // ========== GitHub API 代理 ==========
    if (path === '/api/github') {
      const targetUrl = request.headers.get('x-target-url');
      if (!targetUrl) {
        return jsonResponse({ error: 'Missing x-target-url' }, 400);
      }

      const ghHeaders = {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Blog-Publisher',
      };

      const ghOptions = {
        method: request.method,
        headers: ghHeaders,
      };

      if (request.method === 'PUT' || request.method === 'POST') {
        const body = await request.text();
        ghOptions.body = body;
      }

      try {
        const ghRes = await fetch(targetUrl, ghOptions);
        const data = await ghRes.text();
        return new Response(data, {
          status: ghRes.status,
          headers: corsHeaders(),
        });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // ========== 又拍云 S3 API 图片上传 ==========
    if (path === '/api/upload' && request.method === 'POST') {
      const fileName = url.searchParams.get('name');
      if (!fileName) {
        return jsonResponse({ error: 'Missing file name' }, 400);
      }

      const imageBuffer = await request.arrayBuffer();
      const contentLength = imageBuffer.byteLength;

      try {
        if (!env.UPYUN_ACCESS_KEY || !env.UPYUN_SECRET_KEY || !env.UPYUN_BUCKET) {
          return jsonResponse({ error: 'Missing Upyun S3 config' }, 500);
        }

        const bucket = env.UPYUN_BUCKET;
        const endpoint = `${bucket}.s3.api.upyun.com`;
        const objectKey = `/${fileName}`;
        const date = new Date().toUTCString();
        const contentType = 'image/webp';

        // AWS S3 V2 签名
        const sign = await signS3V2(env.UPYUN_ACCESS_KEY, env.UPYUN_SECRET_KEY, 'PUT', `/${bucket}${objectKey}`, contentType, date, contentLength);

        const s3Url = `https://${endpoint}${objectKey}`;
        const s3Res = await fetch(s3Url, {
          method: 'PUT',
          headers: {
            'Authorization': sign,
            'Date': date,
            'Content-Type': contentType,
            'Content-Length': String(contentLength),
            'Host': endpoint,
          },
          body: imageBuffer,
        });

        if (s3Res.ok || s3Res.status === 200) {
          const domain = (env.UPYUN_DOMAIN || '').replace(/\/+$/, '');
          return jsonResponse({ url: `${domain}/${fileName}` });
        } else {
          const errText = await s3Res.text();
          return jsonResponse({ error: 'S3 Upload failed', detail: errText, status: s3Res.status }, 500);
        }
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token, x-target-url',
    'Content-Type': 'application/json',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}

// ==========================================
// AWS S3 V2 签名 (又拍云 S3 兼容)
// Authorization: AWS <AccessKey>:<Signature>
// Signature = Base64(HMAC-SHA1(SecretKey, "METHOD\n\nContent-Type\nDate\nObjectKey"))
// ==========================================
async function signS3V2(accessKey, secretKey, method, objectKey, contentType, date, contentLength) {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n${objectKey}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stringToSign));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `AWS ${accessKey}:${signatureBase64}`;
}
