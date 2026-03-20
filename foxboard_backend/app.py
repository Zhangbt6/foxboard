"""
FoxBoard 后端主入口 - FastAPI
提供任务看板 + Agent 管理 API
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from foxboard_backend.database import init_db
from foxboard_backend.routers import agents, tasks, events, workflows

# 初始化数据库
init_db()

app = FastAPI(
    title="FoxBoard API",
    description="花火看板系统后端 API",
    version="0.1.0",
)

# CORS：允许前端开发服务器访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 开发环境全允许，生产环境应限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(agents.router)
app.include_router(tasks.router)
app.include_router(events.router)
app.include_router(workflows.router)

@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "service": "FoxBoard API", "version": "0.1.0"}

@app.get("/health", tags=["health"])
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
