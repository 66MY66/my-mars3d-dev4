<template>
  <nav class="modules-nav" aria-label="卫星遥感软件模块">
    <button
      v-for="module in modules"
      :key="module.id"
      class="module-button"
      :class="{ active: activeModuleId === module.id }"
      type="button"
      @click="onModuleClick(module)"
    >
      {{ module.label }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import {
  DATA_MANAGEMENT_HOME,
  DATA_MANAGEMENT_MODULE_ID,
  VISUALIZATION_MODULE_ID,
  getInitialModuleId,
  getNavigableModuleId
} from "./topModules"

type ModuleItem = { id: string; label: string }

const modules: ModuleItem[] = [
  { id: "preprocess", label: "预处理" },
  { id: "risk-monitoring", label: "风险监测" },
  { id: "anomaly-monitoring", label: "异常监测" },
  { id: "loss-assessment", label: "损失评估" },
  { id: DATA_MANAGEMENT_MODULE_ID, label: "数据管理" },
  { id: VISUALIZATION_MODULE_ID, label: "可视化" }
]

const ACTIVE_MODULE_STORAGE_KEY = "top_module_active"
const router = useRouter()
const route = useRoute()
const activeModuleId = ref(getInitialModuleId(route.path, localStorage.getItem(ACTIVE_MODULE_STORAGE_KEY)))

function reloadInitial3DView() {
  const url = new URL(window.location.href)
  const mode = String(process.env.ROUTER_MODE || "hash")
  if (mode === "history") {
    const base = String(process.env.BASE_URL || "/")
    url.pathname = base.endsWith("/") ? base : `${base}/`
    url.hash = ""
  } else {
    url.hash = "#/"
  }
  window.location.assign(url.toString())
}

async function onModuleClick(module: ModuleItem) {
  if (module.id === DATA_MANAGEMENT_MODULE_ID) {
    if (route.path !== DATA_MANAGEMENT_HOME) {
      await router.push(DATA_MANAGEMENT_HOME)
    }
    activeModuleId.value = getNavigableModuleId(module.id, activeModuleId.value)
    localStorage.setItem(ACTIVE_MODULE_STORAGE_KEY, activeModuleId.value)
    return
  }

  if (module.id === VISUALIZATION_MODULE_ID) {
    reloadInitial3DView()
  }
  // Other subsystem pages are not connected yet; leave the active state unchanged.
}
</script>

<style scoped>
.modules-nav { display: flex; align-items: center; gap: 12px; }
.module-button {
  height: 32px; box-sizing: border-box; padding: 5px 10px; border: none; border-radius: 2px;
  background: transparent; color: var(--syc-menu-text, #1d2129); cursor: pointer;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 14px; font-weight: 500;
  line-height: 22px; white-space: nowrap; transition: color var(--transition-fast), background var(--transition-fast);
}
.module-button:hover, .module-button.active {
  color: var(--syc-submenu-active, #165dff); background: var(--nav-active-box, #e8f3ff);
}
</style>
