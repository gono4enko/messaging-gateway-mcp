"""MCP Instagram — FastMCP (streamable-http)."""
import json
import os
from mcp.server.fastmcp import FastMCP

IG_ACCOUNT_ID = os.environ.get("IG_ACCOUNT_ID", "17841419820082008")
IG_TOKEN = os.environ.get("IG_ACCESS_TOKEN", "")
GRAPH = "https://graph.instagram.com/v25.0"

mcp = FastMCP("instagram", host="0.0.0.0", port=8090)


def _ig_get(path: str, params: dict = None) -> str:
    import httpx
    client = httpx.Client(timeout=10)
    try:
        r = client.get(f"{GRAPH}{path}", params=params or {}, headers={"Authorization": f"Bearer {IG_TOKEN}"})
        r.raise_for_status()
        return r.text
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def instagram_insights(metric: str = "reach,views,accounts_engaged", period: str = "day") -> str:
    """Instagram insights: reach, views, accounts_engaged. NOT impressions (removed from API)."""
    return _ig_get(f"/{IG_ACCOUNT_ID}/insights", {"metric": metric, "period": period, "metric_type": "total_value"})


@mcp.tool()
def instagram_media(count: int = 10) -> str:
    """Recent Instagram posts: id, caption, permalink, media_type, like_count, comments_count, timestamp. ONE request, no pagination."""
    raw = _ig_get(f"/{IG_ACCOUNT_ID}/media", {"fields": "id,caption,permalink,media_type,like_count,comments_count,timestamp", "limit": min(count, 25)})
    try:
        data = json.loads(raw)
        for item in data.get("data", []):
            c = item.get("caption") or ""
            item["caption"] = c[:197] + "..." if len(c) > 200 else c
        return json.dumps(data, ensure_ascii=False, indent=2)
    except Exception:
        return raw


@mcp.tool()
def instagram_followers() -> str:
    """Instagram account info: username, followers_count, media_count."""
    return _ig_get(f"/{IG_ACCOUNT_ID}", {"fields": "username,followers_count,media_count"})


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
