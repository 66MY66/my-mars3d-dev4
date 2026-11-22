# 第一阶段：构建阶段
FROM node:20-alpine as builder

# 安装构建依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

# 使用 npm 镜像源
ENV npm_config_registry=https://registry.npmmirror.com/

# 启用 pnpm（与宿主机一致，走 lockfile 与 patchedDependencies）
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 复制依赖清单与补丁，先装依赖以利用层缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY scripts ./scripts

# 安装依赖（锁定版本 + 应用 mars3d 补丁）
RUN pnpm install --frozen-lockfile

# 复制源码
COPY . .

# 构建项目
RUN pnpm build

# 第二阶段：运行阶段（nginx 托管静态产物，/mars3d/ 子路径与生产 gateway 语义一致）
FROM nginx:1.27.5-alpine

# 从构建阶段复制产物（构建 base 为 /mars3d/，产物在 dist/mars3d）
COPY --from=builder /app/dist/mars3d /usr/share/nginx/html

# 站点配置：/mars3d/* 前缀改写后落到同一份产物
COPY nginx.frontend.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 3000

