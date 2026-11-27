<template>
  <span class="account-btn">
    <a-tooltip title="账号" :mouseEnterDelay="0.4" :autoAdjustOverflow="true">
      <button class="account-trigger" type="button" aria-label="账号" @click="openLogin">
        <img class="account-avatar" :src="avatarUrl" alt="" />
        <span class="account-chevron" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.15 5.25L7 9.05L10.85 5.25" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </button>
    </a-tooltip>
  </span>
</template>

<script setup lang="ts">
import avatarUrl from "@/assets/account-avatar.png?url"

function openLogin() {
  window.dispatchEvent(new CustomEvent("openLogin"))
}
</script>

<style scoped>
/* 顶栏高 54px：32px 内容上下各留 11px；与设置按钮间隔 20px，右侧仍用顶栏 20px 内边距 */
.account-btn {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  height: 32px;
  margin: 11px 0;
  margin-left: 20px;
}

.account-trigger {
  width: 48px;
  height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  box-sizing: border-box;
  color: #4E5969;
  transition: transform var(--transition-fast);
}

:root[data-theme="dark"] .account-trigger {
  color: var(--syc-menu-text);
}

.account-trigger:hover {
  transform: translateY(-1px);
}

.account-avatar {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.account-chevron {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.account-chevron svg {
  display: block;
  width: 14px;
  height: 14px;
}
</style>
