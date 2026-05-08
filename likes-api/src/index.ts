/**
 * 点赞系统后端 API
 * Cloudflare Workers + KV 存储
 */

export interface Env {
  LIKES_KV: KVNamespace;
  TURNSTILE_SECRET: string;
  ALLOWED_ORIGIN: string;
}

interface LikesResponse {
  counts: Record<string, number>;
  myLikes: string[];
}

interface SubmitResponse {
  success: boolean;
  count?: number;
  error?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env.ALLOWED_ORIGIN, origin),
      });
    }

    // GET /api/likes - 获取所有点赞数据
    if (request.method === 'GET' && url.pathname === '/api/likes') {
      return handleGetLikes(env, origin);
    }

    // POST /api/likes/submit - 提交点赞
    if (request.method === 'POST' && url.pathname === '/api/likes/submit') {
      return handlePostLike(request, env, origin);
    }

    // 健康检查
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

/**
 * 获取所有点赞数据
 */
async function handleGetLikes(env: Env, origin: string): Promise<Response> {
  try {
    const keys = await env.LIKES_KV.list({ prefix: 'count:' });
    const counts: Record<string, number> = {};

    // 并行获取所有计数
    const promises = keys.keys.map(async (key) => {
      const url = key.name.replace('count:', '');
      const count = await env.LIKES_KV.get(key.name);
      if (count) {
        counts[url] = parseInt(count, 10);
      }
    });

    await Promise.all(promises);

    const response: LikesResponse = {
      counts,
      myLikes: [], // 简化版不追踪用户点赞历史
    };

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60', // 缓存 60 秒
        ...corsHeaders(env.ALLOWED_ORIGIN, origin),
      },
    });
  } catch (error) {
    console.error('获取点赞数据失败:', error);
    return new Response(JSON.stringify({ counts: {}, myLikes: [] }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.ALLOWED_ORIGIN, origin),
      },
    });
  }
}

/**
 * 提交点赞
 */
async function handlePostLike(request: Request, env: Env, origin: string): Promise<Response> {
  const turnstileToken = request.headers.get('CF-Turnstile-Response');

  // 验证 Turnstile Token
  if (!turnstileToken) {
    return new Response(JSON.stringify({
      success: false,
      error: '缺少人机验证',
    } as SubmitResponse), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.ALLOWED_ORIGIN, origin),
      },
    });
  }

  // 验证 Turnstile
  const turnstileValid = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, request);
  if (!turnstileValid) {
    return new Response(JSON.stringify({
      success: false,
      error: '人机验证失败',
    } as SubmitResponse), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.ALLOWED_ORIGIN, origin),
      },
    });
  }

  // 解析请求体
  let body: { url?: string };
  try {
    body = await request.json() as { url?: string };
  } catch {
    return new Response(JSON.stringify({
      success: false,
      error: '无效的请求体',
    } as SubmitResponse), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.ALLOWED_ORIGIN, origin),
      },
    });
  }

  const url = body.url;
  if (!url) {
    return new Response(JSON.stringify({
      success: false,
      error: '缺少 url 参数',
    } as SubmitResponse), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.ALLOWED_ORIGIN, origin),
      },
    });
  }

  // 验证 URL 格式（防止滥用）
  try {
    new URL(url);
  } catch {
    return new Response(JSON.stringify({
      success: false,
      error: '无效的 URL',
    } as SubmitResponse), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(env.ALLOWED_ORIGIN, origin),
      },
    });
  }

  // 增加点赞数
  const key = `count:${url}`;
  const currentStr = await env.LIKES_KV.get(key);
  const current = parseInt(currentStr || '0', 10);
  const newCount = current + 1;

  await env.LIKES_KV.put(key, String(newCount));

  return new Response(JSON.stringify({
    success: true,
    count: newCount,
  } as SubmitResponse), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env.ALLOWED_ORIGIN, origin),
    },
  });
}

/**
 * 验证 Cloudflare Turnstile Token
 */
async function verifyTurnstile(token: string, secret: string, request: Request): Promise<boolean> {
  try {
    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', token);
    // 可选：添加远程 IP
    // formData.append('remoteip', request.headers.get('CF-Connecting-IP') || '');

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json() as { success: boolean; 'error-codes'?: string[] };

    if (!data.success) {
      console.error('Turnstile 验证失败:', data['error-codes']);
    }

    return data.success;
  } catch (error) {
    console.error('Turnstile 验证请求失败:', error);
    return false;
  }
}

/**
 * 生成 CORS 响应头
 */
function corsHeaders(allowed: string, origin: string): Record<string, string> {
  // 检查请求来源是否允许
  let allowedOrigin = allowed;
  if (allowed !== '*') {
    try {
      const allowedHost = new URL(allowed).host;
      const requestHost = origin ? new URL(origin).host : '';
      if (requestHost && (requestHost === allowedHost || requestHost.endsWith('.' + allowedHost))) {
        allowedOrigin = origin;
      }
    } catch {
      // URL 解析失败，使用默认允许源
    }
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, CF-Turnstile-Response',
    'Access-Control-Max-Age': '86400', // 24 小时
  };
}
