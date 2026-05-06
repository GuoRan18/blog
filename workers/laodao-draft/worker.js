// 云草稿服务 Worker
// 使用 Cloudflare KV 存储，部署到 Cloudflare Workers

export default {
  async fetch(request, env) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
        },
      });
    }

    // ========== 验证密钥 ==========
    const adminToken = request.headers.get('x-admin-token') || '';
    if (adminToken !== env.ADMIN_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ========== 获取草稿列表 ==========
    if (path === '/api/drafts' && request.method === 'GET') {
      const list = await env.DRAFTS_KV.list();
      const drafts = [];
      for (const key of list.keys) {
        const value = await env.DRAFTS_KV.get(key.name, 'json');
        if (value) {
          drafts.push({ id: key.name, ...value });
        }
      }
      // 按时间倒序
      drafts.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      return jsonResponse(drafts);
    }

    // ========== 保存草稿 ==========
    if (path === '/api/drafts' && request.method === 'POST') {
      const body = await request.json();
      const id = body.id || `draft_${Date.now()}`;
      const now = Date.now();

      const draft = {
        content: body.content || '',
        tags: body.tags || [],
        location: body.location || null,
        createdAt: body.createdAt || now,
        updatedAt: now,
      };

      await env.DRAFTS_KV.put(id, JSON.stringify(draft));
      return jsonResponse({ id, ...draft });
    }

    // ========== 删除草稿 ==========
    if (path === '/api/drafts' && request.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return jsonResponse({ error: 'Missing id' }, 400);

      await env.DRAFTS_KV.delete(id);
      return jsonResponse({ success: true, id });
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Content-Type': 'application/json',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}
