<template>
  <div class="satellite-data-pool-page">
    <div class="content-header">
      <div class="header-text">
        <div class="page-label">卫星遥感数据管理子系统 · 数据资源池管理</div>
      </div>
      <div class="header-actions">
        <a-button type="primary" @click="showCreateDialog">
          <PlusOutlined />
          创建资源池
        </a-button>
        <a-button @click="showImportDialog">
          <UploadOutlined />
          数据接入
        </a-button>
        <a-button @click="refreshData">
          <ReloadOutlined />
          刷新
        </a-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="8">
        <a-card>
          <a-statistic title="资源池总数" :value="statistics.totalPools">
            <template #prefix>📦</template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card>
          <a-statistic title="数据集总数" :value="statistics.datasetCount">
            <template #prefix>🗂️</template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card>
          <a-statistic title="数据条目总数" :value="statistics.itemCount">
            <template #prefix>🛰️</template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <div class="stats-cards-layout">
    <a-card :bordered="false" :class="['access-data-card', { 'is-expanded': expandedCards.access }]">
      <template #title>
        <span class="access-data-title">接入数据</span>
      </template>
      <template #extra>
        <div class="card-display-actions">
          <a-button type="text" class="card-expand-button" @click="toggleCard('access')">
            <FullscreenExitOutlined v-if="expandedCards.access" />
            <FullscreenOutlined v-else />
          </a-button>
          <a-radio-group v-model:value="accessPeriod" size="small" button-style="solid" @change="handleAccessPeriodChange">
          <a-radio-button value="month">月周期</a-radio-button>
          <a-radio-button value="week">周周期</a-radio-button>
          </a-radio-group>
        </div>
      </template>
      <div class="access-data-content">
        <div ref="accessPieChart" class="access-pie-chart" />
        <div class="access-detail-list">
          <div v-for="item in accessCategories" :key="item.name" class="access-detail-row">
            <span class="access-detail-name"><i :style="{ backgroundColor: item.color }" />{{ item.name }}</span>
            <span class="access-detail-count">{{ item.count }}</span>
            <span class="access-detail-percent">{{ item.percent }}%</span>
          </div>
        </div>
        <div class="access-trend-wrap">
          <div ref="accessTrendChart" class="access-trend-chart" />
          <div v-if="hoverAccessDetail.visible" class="access-hover-detail">
            <div class="access-hover-date">{{ hoverAccessDetail.date }}</div>
            <div v-for="item in hoverAccessDetail.items" :key="item.name" class="access-hover-row">
              <span class="access-hover-name"><i :style="{ backgroundColor: item.color }" />{{ item.name }}</span>
              <strong>{{ item.count }}</strong>
            </div>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 资源池列表 -->
    <a-card :bordered="false" :class="['access-data-card', 'output-data-card', { 'is-expanded': expandedCards.output }]">
      <template #title>
        <span class="access-data-title">产出情况分布</span>
      </template>
      <template #extra>
        <div class="card-display-actions">
          <a-button type="text" class="card-expand-button" @click="toggleCard('output')">
            <FullscreenExitOutlined v-if="expandedCards.output" />
            <FullscreenOutlined v-else />
          </a-button>
          <a-radio-group v-model:value="outputPeriod" size="small" button-style="solid" @change="handleOutputPeriodChange">
          <a-radio-button value="month">月周期</a-radio-button>
          <a-radio-button value="week">周周期</a-radio-button>
          </a-radio-group>
        </div>
      </template>
      <div class="access-data-content">
        <div ref="outputPieChart" class="access-pie-chart" />
        <div class="access-detail-list">
          <div v-for="item in outputCategories" :key="item.name" class="access-detail-row">
            <span class="access-detail-name"><i :style="{ backgroundColor: item.color }" />{{ item.name }}</span>
            <span class="access-detail-count">{{ item.count }}</span>
            <span class="access-detail-percent">{{ item.percent }}%</span>
          </div>
        </div>
        <div class="access-trend-wrap">
          <div ref="outputTrendChart" class="access-trend-chart" />
          <div v-if="hoverOutputDetail.visible" class="access-hover-detail">
            <div class="access-hover-date">{{ hoverOutputDetail.date }}</div>
            <div v-for="item in hoverOutputDetail.items" :key="item.name" class="access-hover-row">
              <span class="access-hover-name"><i :style="{ backgroundColor: item.color }" />{{ item.name }}</span>
              <strong>{{ item.count }}</strong>
            </div>
          </div>
        </div>
      </div>
    </a-card>

    <a-card :bordered="false" :class="['access-data-card', 'output-data-card', { 'is-expanded': expandedCards.upload }]">
      <template #title>
        <span class="access-data-title">数据上传情况</span>
      </template>
      <template #extra>
        <div class="card-display-actions">
          <a-button type="text" class="card-expand-button" @click="toggleCard('upload')">
            <FullscreenExitOutlined v-if="expandedCards.upload" />
            <FullscreenOutlined v-else />
          </a-button>
          <a-radio-group v-model:value="uploadPeriod" size="small" button-style="solid" @change="handleUploadPeriodChange">
          <a-radio-button value="month">月周期</a-radio-button>
          <a-radio-button value="week">周周期</a-radio-button>
          </a-radio-group>
        </div>
      </template>
      <div class="access-data-content">
        <div ref="uploadPieChart" class="access-pie-chart" />
        <div class="access-detail-list">
          <div v-for="item in uploadCategories" :key="item.name" class="access-detail-row">
            <span class="access-detail-name"><i :style="{ backgroundColor: item.color }" />{{ item.name }}</span>
            <span class="access-detail-count">{{ item.count }}</span>
            <span class="access-detail-percent">{{ item.percent }}%</span>
          </div>
        </div>
        <div class="access-trend-wrap">
          <div ref="uploadTrendChart" class="access-trend-chart" />
          <div v-if="hoverUploadDetail.visible" class="access-hover-detail">
            <div class="access-hover-date">{{ hoverUploadDetail.date }}</div>
            <div v-for="item in hoverUploadDetail.items" :key="item.name" class="access-hover-row">
              <span class="access-hover-name"><i :style="{ backgroundColor: item.color }" />{{ item.name }}</span>
              <strong>{{ item.count }}</strong>
            </div>
          </div>
        </div>
      </div>
    </a-card>
    </div>

    <a-card :bordered="false" class="table-card">
      <template #title>
        <DatabaseOutlined /> 资源池列表
      </template>
      <template #extra>
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="搜索资源池名称或ID"
          style="width: 250px"
          @search="handleSearch"
        />
      </template>

      <a-table
        :columns="columns"
        :data-source="filteredPoolList"
        :pagination="paginationConfig"
        :loading="loading"
        row-key="poolId"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'poolName'">
            <a-tag color="blue">{{ record.poolName }}</a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-badge
              :status="record.status === '正常' ? 'success' : 'error'"
              :text="record.status"
            />
          </template>
          <template v-else-if="column.key === 'operation'">
            <a @click="viewPoolDetail(record)">详情</a>
            <a-divider type="vertical" />
            <a @click="viewMonitoring(record)">监控</a>
            <a-divider type="vertical" />
            <a @click="viewScheduling(record)">调度</a>
            <a-divider type="vertical" />
            <a style="color: #f5222d" @click="deletePool(record)">删除</a>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 创建资源池对话框 -->
    <a-modal
      title="创建资源池"
      :open="createDialogVisible"
      :confirm-loading="confirmLoading"
      @ok="handleCreatePool"
      @cancel="createDialogVisible = false"
    >
      <a-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
      >
        <a-form-item label="资源池名称" name="poolName">
          <a-input v-model:value="createForm.poolName" placeholder="请输入资源池名称" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="createForm.description" :rows="3" placeholder="请输入资源池描述" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 数据接入对话框 -->
    <a-modal
      title="数据接入"
      :open="importDialogVisible"
      :confirm-loading="confirmLoading"
      :ok-text="importProgress > 0 ? `上传中 ${importProgress}%` : '确定'"
      @ok="handleDataImport"
      @cancel="importDialogVisible = false"
    >
      <a-form
        ref="importFormRef"
        :model="importForm"
        :rules="importRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
      >
        <a-form-item label="目标资源池" name="targetPoolId">
          <a-select v-model:value="importForm.targetPoolId" placeholder="请选择目标资源池">
            <a-select-option v-for="pool in poolList" :key="pool.poolId" :value="pool.poolId">
              {{ pool.poolName }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="数据源" name="dataSource">
          <a-select v-model:value="importForm.dataSource" placeholder="请选择数据源">
            <a-select-option value="catalog">系统数据目录检索</a-select-option>
            <a-select-option value="local">本地上传</a-select-option>
          </a-select>
        </a-form-item>
        <template v-if="importForm.dataSource === 'catalog'">
          <a-form-item label="关键词">
            <a-input-search
              v-model:value="catalogSearch.keyword"
              placeholder="按数据集/条目名称搜索"
              @search="searchCatalogItems"
            />
          </a-form-item>
          <a-form-item label="目录数据" :wrapper-col="{ span: 16 }">
            <a-table
              :columns="catalogColumns"
              :data-source="catalogSearch.results"
              :loading="catalogSearch.loading"
              size="small"
              row-key="key"
              :pagination="{ pageSize: 5 }"
              :scroll="{ y: 240 }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'pick'">
                  <a-checkbox
                    :checked="selectedCatalogKeys.includes(record.key)"
                    @change="(e) => toggleCatalogPick(record, e.target.checked)"
                  />
                </template>
              </template>
            </a-table>
            <div style="margin-top: 4px; color: #999">
              已选 {{ selectedCatalogKeys.length }} 条，接入后将在所选资源池下生成数据集条目
            </div>
          </a-form-item>
        </template>
        <a-form-item label="数据文件" name="file" v-if="importForm.dataSource === 'local'">
          <a-upload
            :max-count="1"
            :before-upload="handleImportFileSelect"
            :file-list="importFileList"
          >
            <a-button>
              <UploadOutlined />
              选择文件
            </a-button>
          </a-upload>
        </a-form-item>
        <a-form-item label="数据验证" v-if="importForm.dataSource === 'local'">
          <a-checkbox v-model:checked="importForm.validateFormat">格式校验</a-checkbox>
          <a-checkbox v-model:checked="importForm.validateIntegrity">完整性校验</a-checkbox>
        </a-form-item>
        <a-form-item label="优先级">
          <a-radio-group v-model:value="importForm.priority">
            <a-radio :value="1">低</a-radio>
            <a-radio :value="2">中</a-radio>
            <a-radio :value="3">高</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script>
import { h } from "vue"
import { message, Modal, Statistic, Badge } from "ant-design-vue"
import {
  PlusOutlined,
  UploadOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined
} from "@ant-design/icons-vue"
import { fromPool, toPoolPayload } from "../api/adapters"
import { poolApi } from "../api/services"
import { uploadArtifact, smartUploadArtifact } from "@mars/widgets/basic/dataset-repository/services/eoapi-artifacts"
import { searchItems, createDataset, updateDatasetContent } from "@mars/widgets/basic/dataset-repository/services/eoapi-datasets"
import * as echarts from "echarts"
import { buildAccessTrend, getAccessDateRange } from "../utils/access-data"

export default {
  name: "SatelliteDataPoolLayout",
  components: {
    PlusOutlined,
    UploadOutlined,
    ReloadOutlined,
    DatabaseOutlined,
    FullscreenOutlined,
    FullscreenExitOutlined,
    AStatistic: Statistic,
    ABadge: Badge
  },
  data() {
    return {
      loading: false,
      confirmLoading: false,
      searchKeyword: "",
      accessPeriod: "month",
      accessPieInstance: null,
      accessTrendInstance: null,
      outputPeriod: "month",
      outputPieInstance: null,
      outputTrendInstance: null,
      expandedCards: {
        access: false,
        output: false,
        upload: false
      },
      uploadPeriod: "month",
      uploadPieInstance: null,
      uploadTrendInstance: null,
      hoverAccessDetail: {
        visible: false,
        date: "",
        items: []
      },
      hoverOutputDetail: {
        visible: false,
        date: "",
        items: []
      },
      hoverUploadDetail: {
        visible: false,
        date: "",
        items: []
      },
      accessCategories: [
        { name: "地面站卫星原始数据", color: "#5B8FF9", count: 128, percent: 47, daily: [] },
        { name: "气象数据", color: "#61DDAA", count: 76, percent: 28, daily: [] },
        { name: "遥感产品数据", color: "#65789B", count: 42, percent: 15, daily: [] },
        { name: "其他数据", color: "#F6BD16", count: 27, percent: 10, daily: [] }
      ],
      outputCategories: [
        { name: "卫星遥感标准数据", color: "#5B8FF9", count: 86, percent: 43, daily: [] },
        { name: "评估报告", color: "#61DDAA", count: 42, percent: 21, daily: [] },
        { name: "风险监测成果", color: "#65789B", count: 38, percent: 19, daily: [] },
        { name: "异常监测成果", color: "#F6BD16", count: 34, percent: 17, daily: [] }
      ],
      uploadCategories: [
        { name: "卫星遥感标准数据", color: "#5B8FF9", count: 74, percent: 41, daily: [] },
        { name: "评估报告", color: "#61DDAA", count: 46, percent: 26, daily: [] },
        { name: "风险监测成果", color: "#65789B", count: 35, percent: 19, daily: [] },
        { name: "异常监测成果", color: "#F6BD16", count: 25, percent: 14, daily: [] }
      ],

      // 统计数据
      statistics: {
        totalPools: 0,
        datasetCount: 0,
        itemCount: 0
      },

      // 资源池列表
      poolList: [],

      // 表格列
      columns: [
        { title: "资源池名称", dataIndex: "poolName", key: "poolName" },
        { title: "资源池ID", dataIndex: "poolId", key: "poolId", width: 200 },
        { title: "数据集数", dataIndex: "totalCapacity", key: "totalCapacity", width: 100 },
        { title: "条目数", dataIndex: "itemCount", key: "itemCount", width: 100 },
        { title: "状态", dataIndex: "status", width: 100 },
        { title: "操作", key: "operation", fixed: "right", width: 240 }
      ],

      // 分页配置
      paginationConfig: {
        current: 1,
        pageSize: 10,
        total: 0,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total) => `共 ${total} 条数据`,
        pageSizeOptions: ["10", "20", "50", "100"]
      },

      // 创建资源池
      createDialogVisible: false,
      createForm: {
        poolName: "",
        description: ""
      },
      createRules: {
        poolName: [{ required: true, message: "请输入资源池名称", trigger: "blur" }]
      },

      // 数据接入
      importDialogVisible: false,
      importForm: {
        targetPoolId: "",
        dataSource: "",
        validateFormat: true,
        validateIntegrity: true,
        priority: 2
      },
      importFile: null,
      importFileList: [],
      importProgress: 0,

      // 目录检索接入
      catalogSearch: {
        keyword: "",
        loading: false,
        results: []
      },
      selectedCatalogKeys: [],
      catalogColumns: [
        { title: "选择", key: "pick", width: 60 },
        { title: "条目", dataIndex: "title", key: "title", ellipsis: true },
        { title: "所属数据集", dataIndex: "collection", key: "collection", ellipsis: true },
        { title: "时间", dataIndex: "datetime", width: 110 }
      ],
      importRules: {
        targetPoolId: [{ required: true, message: "请选择目标资源池", trigger: "change" }],
        dataSource: [{ required: true, message: "请选择数据源", trigger: "change" }]
      }
    }
  },
  mounted() {
    this.loadPools()
    this.$nextTick(() => this.renderAccessCharts())
    this.$nextTick(() => this.renderOutputCharts())
    this.$nextTick(() => this.renderUploadCharts())
    window.addEventListener("resize", this.resizeAccessCharts)
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.resizeAccessCharts)
    this.accessPieInstance?.dispose()
    this.accessTrendInstance?.dispose()
    this.outputPieInstance?.dispose()
    this.outputTrendInstance?.dispose()
    this.uploadPieInstance?.dispose()
    this.uploadTrendInstance?.dispose()
    this.hoverAccessDetail.visible = false
    this.hoverOutputDetail.visible = false
    this.hoverUploadDetail.visible = false
  },
  computed: {
    filteredPoolList() {
      if (!this.searchKeyword) {
        return this.poolList
      }
      return this.poolList.filter(
        (pool) =>
          pool.poolName.includes(this.searchKeyword) ||
          pool.poolId.includes(this.searchKeyword)
      )
    }
  },
  methods: {
    toggleCard(cardKey) {
      this.expandedCards[cardKey] = !this.expandedCards[cardKey]
      this.$nextTick(() => {
        if (cardKey === "access") {
          this.renderAccessCharts()
        }
        if (cardKey === "output") {
          this.renderOutputCharts()
        }
        if (cardKey === "upload") {
          this.renderUploadCharts()
        }
        requestAnimationFrame(() => this.resizeAccessCharts())
      })
    },

    handleAccessPeriodChange() {
      this.renderAccessCharts()
    },

    handleOutputPeriodChange() {
      this.renderOutputCharts()
    },

    handleUploadPeriodChange() {
      this.renderUploadCharts()
    },

    renderAccessCharts() {
      if (!this.$refs.accessPieChart || !this.$refs.accessTrendChart) {
        return
      }
      const dates = getAccessDateRange(this.accessPeriod)
      const length = dates.length
      this.accessCategories.forEach((item, categoryIndex) => {
        item.daily = Array.from({ length }, (_, index) => Math.max(0, Math.round(6 + categoryIndex * 3 + Math.sin(index * 0.8 + categoryIndex) * 4 + (index % 5))))
      })
      const visibleCategories = this.accessCategories.filter((item) => item.count > 0)
      const trend = buildAccessTrend(visibleCategories, dates)
      const tooltipDates = getAccessDateRange(this.accessPeriod, new Date(), "full")
      this.accessPieInstance?.dispose()
      this.accessTrendInstance?.dispose()
      this.accessPieInstance = echarts.init(this.$refs.accessPieChart)
      this.accessTrendInstance = echarts.init(this.$refs.accessTrendChart)
      this.accessPieInstance.setOption({
        tooltip: { trigger: "item", formatter: "{b}<br/>接入数量：{c}<br/>占比：{d}%" },
        series: [{ type: "pie", radius: ["58%", "78%"], center: ["50%", "50%"], label: { show: false }, data: this.accessCategories.map((item) => ({ name: item.name, value: item.count, itemStyle: { color: item.color } })) }]
      })
      if (!this.expandedCards.access) {
        this.accessTrendInstance?.dispose()
        this.accessTrendInstance = null
        this.hoverAccessDetail.visible = false
        return
      }
      this.accessTrendInstance.setOption({
        tooltip: { show: false },
        axisPointer: { show: true, type: "line", snap: true, lineStyle: { color: "#c9cdd4", type: "dashed" } },
        legend: { top: 0, right: 0, icon: "circle", textStyle: { color: "#4e5969" }, data: trend.map((item) => item.name) },
        grid: { left: 42, right: 12, top: 34, bottom: 28 },
        xAxis: { type: "category", boundaryGap: false, data: dates, axisLine: { lineStyle: { color: "#d9d9d9" } } },
        yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { type: "dashed", color: "#e5e6eb" } } },
        series: trend.map((item) => ({ name: item.name, type: "line", smooth: true, showSymbol: false, symbol: "circle", symbolSize: 7, emphasis: { focus: "series", scale: true, symbol: "circle", symbolSize: 9 }, data: item.data, lineStyle: { color: item.color, width: 2 }, itemStyle: { color: item.color } }))
      })
      this.accessTrendInstance.on("updateAxisPointer", (event) => {
        const dataIndex = Number(event.axesInfo?.[0]?.value)
        if (!Number.isInteger(dataIndex) || dataIndex < 0 || dataIndex >= dates.length) {
          return
        }
        this.hoverAccessDetail = {
          visible: true,
          date: tooltipDates[dataIndex],
          items: visibleCategories
            .map((item) => ({ name: item.name, color: item.color, count: Number(item.daily[dataIndex] || 0) }))
            .filter((item) => item.count > 0)
        }
      })
      this.accessTrendInstance.on("globalout", () => {
        this.hoverAccessDetail.visible = false
      })
    },

    resizeAccessCharts() {
      this.accessPieInstance?.resize()
      this.accessTrendInstance?.resize()
      this.outputPieInstance?.resize()
      this.outputTrendInstance?.resize()
      this.uploadPieInstance?.resize()
      this.uploadTrendInstance?.resize()
    },

    renderOutputCharts() {
      if (!this.$refs.outputPieChart || !this.$refs.outputTrendChart) {
        return
      }
      const dates = getAccessDateRange(this.outputPeriod)
      const tooltipDates = getAccessDateRange(this.outputPeriod, new Date(), "full")
      const visibleCategories = this.outputCategories.filter((item) => item.count > 0)
      visibleCategories.forEach((item, categoryIndex) => {
        item.daily = Array.from({ length: dates.length }, (_, index) => Math.max(0, Math.round(4 + categoryIndex * 2 + Math.cos(index * 0.7 + categoryIndex) * 3 + (index % 4))))
      })
      const trend = buildAccessTrend(visibleCategories, dates)
      this.outputPieInstance?.dispose()
      this.outputTrendInstance?.dispose()
      this.outputPieInstance = echarts.init(this.$refs.outputPieChart)
      this.outputTrendInstance = echarts.init(this.$refs.outputTrendChart)
      this.outputPieInstance.setOption({
        tooltip: { trigger: "item", formatter: "{b}<br/>产出数量：{c}<br/>占比：{d}%" },
        series: [{ type: "pie", radius: ["58%", "78%"], center: ["50%", "50%"], label: { show: false }, data: visibleCategories.map((item) => ({ name: item.name, value: item.count, itemStyle: { color: item.color } })) }]
      })
      if (!this.expandedCards.output) {
        this.outputTrendInstance?.dispose()
        this.outputTrendInstance = null
        this.hoverOutputDetail.visible = false
        return
      }
      this.outputTrendInstance.setOption({
        tooltip: { show: false },
        axisPointer: { show: true, type: "line", snap: true, lineStyle: { color: "#c9cdd4", type: "dashed" } },
        legend: { top: 0, right: 0, icon: "circle", textStyle: { color: "#4e5969" }, data: trend.map((item) => item.name) },
        grid: { left: 42, right: 12, top: 34, bottom: 28 },
        xAxis: { type: "category", boundaryGap: false, data: dates, axisLine: { lineStyle: { color: "#d9d9d9" } } },
        yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { type: "dashed", color: "#e5e6eb" } } },
        series: trend.map((item) => ({ name: item.name, type: "line", smooth: true, showSymbol: false, symbol: "circle", symbolSize: 7, emphasis: { focus: "series", scale: true, symbol: "circle", symbolSize: 9 }, data: item.data, lineStyle: { color: item.color, width: 2 }, itemStyle: { color: item.color } }))
      })
      this.outputTrendInstance.on("updateAxisPointer", (event) => {
        const dataIndex = Number(event.axesInfo?.[0]?.value)
        if (!Number.isInteger(dataIndex) || dataIndex < 0 || dataIndex >= dates.length) {
          return
        }
        this.hoverOutputDetail = {
          visible: true,
          date: tooltipDates[dataIndex],
          items: visibleCategories
            .map((item) => ({ name: item.name, color: item.color, count: Number(item.daily[dataIndex] || 0) }))
            .filter((item) => item.count > 0)
        }
      })
      this.outputTrendInstance.on("globalout", () => {
        this.hoverOutputDetail.visible = false
      })
    },

    renderUploadCharts() {
      if (!this.$refs.uploadPieChart || !this.$refs.uploadTrendChart) {
        return
      }
      const dates = getAccessDateRange(this.uploadPeriod)
      const tooltipDates = getAccessDateRange(this.uploadPeriod, new Date(), "full")
      const visibleCategories = this.uploadCategories.filter((item) => item.count > 0)
      visibleCategories.forEach((item, categoryIndex) => {
        item.daily = Array.from({ length: dates.length }, (_, index) => Math.max(0, Math.round(3 + categoryIndex * 2 + Math.sin(index * 0.65 + categoryIndex) * 3 + (index % 3))))
      })
      const trend = buildAccessTrend(visibleCategories, dates)
      this.uploadPieInstance?.dispose()
      this.uploadTrendInstance?.dispose()
      this.uploadPieInstance = echarts.init(this.$refs.uploadPieChart)
      this.uploadTrendInstance = echarts.init(this.$refs.uploadTrendChart)
      this.uploadPieInstance.setOption({
        tooltip: { trigger: "item", formatter: "{b}<br/>上传数量：{c}<br/>占比：{d}%" },
        series: [{ type: "pie", radius: ["58%", "78%"], center: ["50%", "50%"], label: { show: false }, data: visibleCategories.map((item) => ({ name: item.name, value: item.count, itemStyle: { color: item.color } })) }]
      })
      if (!this.expandedCards.upload) {
        this.uploadTrendInstance?.dispose()
        this.uploadTrendInstance = null
        this.hoverUploadDetail.visible = false
        return
      }
      this.uploadTrendInstance.setOption({
        tooltip: { show: false },
        axisPointer: { show: true, type: "line", snap: true, lineStyle: { color: "#c9cdd4", type: "dashed" } },
        legend: { top: 0, right: 0, icon: "circle", textStyle: { color: "#4e5969" }, data: trend.map((item) => item.name) },
        grid: { left: 42, right: 12, top: 34, bottom: 28 },
        xAxis: { type: "category", boundaryGap: false, data: dates, axisLine: { lineStyle: { color: "#d9d9d9" } } },
        yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { type: "dashed", color: "#e5e6eb" } } },
        series: trend.map((item) => ({ name: item.name, type: "line", smooth: true, showSymbol: false, symbol: "circle", symbolSize: 7, emphasis: { focus: "series", scale: true, symbol: "circle", symbolSize: 9 }, data: item.data, lineStyle: { color: item.color, width: 2 }, itemStyle: { color: item.color } }))
      })
      this.uploadTrendInstance.on("updateAxisPointer", (event) => {
        const dataIndex = Number(event.axesInfo?.[0]?.value)
        if (!Number.isInteger(dataIndex) || dataIndex < 0 || dataIndex >= dates.length) {
          return
        }
        this.hoverUploadDetail = {
          visible: true,
          date: tooltipDates[dataIndex],
          items: visibleCategories
            .map((item) => ({ name: item.name, color: item.color, count: Number(item.daily[dataIndex] || 0) }))
            .filter((item) => item.count > 0)
        }
      })
      this.uploadTrendInstance.on("globalout", () => {
        this.hoverUploadDetail.visible = false
      })
    },

    async loadPools(showSuccess = false) {
      this.loading = true
      try {
        const page = await poolApi.list({
          pageNo: this.paginationConfig.current,
          pageSize: this.paginationConfig.pageSize
        })
        this.poolList = page.records.map(fromPool)
        this.paginationConfig.total = page.total
        this.statistics.totalPools = page.total
        this.statistics.datasetCount = this.poolList.reduce((sum, pool) => sum + (Number(pool.totalCapacity) || 0), 0)
        this.statistics.itemCount = this.poolList.reduce((sum, pool) => sum + (Number(pool.itemCount) || 0), 0)
        if (showSuccess) { message.success("数据已刷新") }
      } catch (error) {
        message.error(error instanceof Error ? error.message : "资源池数据加载失败")
      } finally {
        this.loading = false
      }
    },
    refreshData() {
      this.loadPools(true)
    },

    handleSearch() {
      // 搜索逻辑由 computed 处理
    },

    handleTableChange(pagination) {
      this.paginationConfig.current = pagination.current
      this.paginationConfig.pageSize = pagination.pageSize
      this.loadPools()
    },

    showCreateDialog() {
      this.createDialogVisible = true
    },

    async handleCreatePool() {
      try {
        await this.$refs.createFormRef.validate()
        this.confirmLoading = true
        await poolApi.add(toPoolPayload({ ...this.createForm }))
        message.success("资源池创建成功")
        this.createDialogVisible = false
        this.$refs.createFormRef.resetFields()
        await this.loadPools()
      } catch (error) {
        if (error instanceof Error) { message.error(error.message) }
      } finally {
        this.confirmLoading = false
      }
    },

    showImportDialog() {
      if (this.poolList.length === 0) {
        message.warning("请先创建资源池")
        return
      }
      this.importDialogVisible = true
    },

    handleImportFileSelect(file) {
      this.importFile = file
      this.importFileList = [file]
      return false // 阻止 a-upload 自动上传，由 handleDataImport 统一提交
    },

    async searchCatalogItems() {
      this.catalogSearch.loading = true
      try {
        const res = await searchItems({ limit: 50 })
        const items = res.success && res.data ? res.data : []
        const kw = String(this.catalogSearch.keyword || "").trim().toLowerCase()
        this.catalogSearch.results = items
          .map((it) => ({
            key: `${it.collection}/${it.id}`,
            id: it.id,
            collection: it.collection,
            title: String(it.properties?.title || it.id),
            datetime: String(it.properties?.datetime || "").slice(0, 10),
            raw: it
          }))
          .filter((r) => !kw || r.title.toLowerCase().includes(kw) || r.collection.toLowerCase().includes(kw))
        if (this.catalogSearch.results.length === 0) {
          message.info("未检索到目录数据")
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : "目录检索失败")
      } finally {
        this.catalogSearch.loading = false
      }
    },

    toggleCatalogPick(record, checked) {
      const keys = [...this.selectedCatalogKeys]
      if (checked) {
        if (!keys.includes(record.key)) { keys.push(record.key) }
      } else {
        const idx = keys.indexOf(record.key)
        if (idx >= 0) { keys.splice(idx, 1) }
      }
      this.selectedCatalogKeys = keys
    },

    async importCatalogItems() {
      const pool = this.poolList.find((p) => p.poolId === this.importForm.targetPoolId)
      if (!pool) {
        message.warning("请选择目标资源池")
        return
      }
      const picked = this.catalogSearch.results.filter((r) => this.selectedCatalogKeys.includes(r.key))
      if (picked.length === 0) {
        message.warning("请先检索并勾选要接入的目录数据")
        return
      }
      this.confirmLoading = true
      try {
        // 按条目所属数据集分组：同一数据集的多条目合入一个新数据集，挂上资源池 tag
        const byCollection = new Map()
        for (const item of picked) {
          const list = byCollection.get(item.collection) || []
          list.push(item)
          byCollection.set(item.collection, list)
        }
        for (const [collectionId, items] of byCollection) {
          const res = await createDataset({
            name: items[0].title,
            description: `自目录 ${collectionId} 接入 ${items.length} 条，资源池：${pool.poolName}`,
            visibility: "private",
            tags: [pool.poolName]
          })
          if (!res.success || !res.data) {
            throw new Error(res.message || "创建数据集失败")
          }
          const newId = res.data.datasetId
          // 把原条目作为 artifactRefs 挂到新数据集首个版本，保留来源溯源
          await updateDatasetContent(newId, {
            message: `自 ${collectionId} 接入`,
            tags: [pool.poolName],
            artifactRefs: items.map((i) => `${collectionId}/${i.id}`)
          })
        }
        message.success(`已接入 ${picked.length} 条目录数据到资源池「${pool.poolName}」`)
        this.importDialogVisible = false
        this.selectedCatalogKeys = []
        this.catalogSearch.results = []
        this.catalogSearch.keyword = ""
        this.$refs.importFormRef.resetFields()
        await this.loadPools()
      } catch (error) {
        message.error(error instanceof Error ? error.message : "目录数据接入失败")
      } finally {
        this.confirmLoading = false
      }
    },

    async handleDataImport() {
      try {
        await this.$refs.importFormRef.validate()
      } catch {
        return
      }
      if (this.importForm.dataSource === "local") {
        await this.importLocalFile()
        return
      }
      if (this.importForm.dataSource === "catalog") {
        await this.importCatalogItems()
      }
    },

    async importLocalFile() {
      const file = this.importFile
      if (!file) {
        message.warning("请选择要接入的数据文件")
        return
      }
      const pool = this.poolList.find((p) => p.poolId === this.importForm.targetPoolId)
      this.confirmLoading = true
      try {
        if (this.importForm.validateIntegrity) {
          // 大文件走分片上传（阈值 20MB，内部自动降级直传）
          await smartUploadArtifact(
            {
              file,
              name: file.name,
              type: "data",
              description: `资源池接入：${pool?.poolName || this.importForm.targetPoolId}（优先级${this.importForm.priority}）`
            },
            { onProgress: (percent) => { this.importProgress = percent } }
          )
        } else {
          await uploadArtifact({
            file,
            name: file.name,
            type: "data",
            description: `资源池接入：${pool?.poolName || this.importForm.targetPoolId}（优先级${this.importForm.priority}）`
          })
        }
        message.success(`数据文件「${file.name}」已接入资源池「${pool?.poolName || this.importForm.targetPoolId}」`)
        this.importDialogVisible = false
        this.importFile = null
        this.importFileList = []
        this.$refs.importFormRef.resetFields()
        await this.loadPools()
      } catch (error) {
        message.error(error instanceof Error ? error.message : "数据接入失败")
      } finally {
        this.confirmLoading = false
        this.importProgress = 0
      }
    },

    viewPoolDetail(record) {
      Modal.info({
        title: "资源池详情",
        content: () =>
          h("div", [
            h("p", [h("strong", "资源池ID："), record.poolId]),
            h("p", [h("strong", "资源池名称："), record.poolName]),
            h("p", [h("strong", "数据集数："), record.totalCapacity]),
            h("p", [h("strong", "数据条目数："), record.itemCount]),
            h("p", [h("strong", "状态："), record.status])
          ]),
        okText: "关闭"
      })
    },

    viewMonitoring() {
      message.info("资源监控功能开发中...")
    },

    viewScheduling() {
      message.info("资源调度功能开发中...")
    },

    deletePool(record) {
      Modal.confirm({
        title: "确定要删除该资源池吗？",
        content: "此操作不可恢复",
        okText: "确定",
        okType: "danger",
        cancelText: "取消",
        onOk: async () => {
          try {
            await poolApi.remove(record.poolId)
            message.success("删除成功")
            await this.loadPools()
          } catch (error) {
            message.error(error instanceof Error ? error.message : "删除失败")
          }
        }
      })
    }
  }
}
</script>

<style scoped lang="less">
.satellite-data-pool-page {
  padding: 20px;
  background: #f0f2f5;
  min-height: calc(100vh - 100px);

  .content-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 20px;
    background: white;
    border-radius: 4px;

    .header-text {
      .page-label {
        font-size: 20px;
        font-weight: 600;
        color: #1890ff;
      }
    }

    .header-actions {
      button {
        margin-left: 8px;
      }
    }
  }

  .table-card {
    margin-top: 16px;
  }

  .stats-cards-layout {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .access-data-card {
    margin-bottom: 0;
    border-radius: 6px;
    min-width: 0;
    order: 1;

    &.is-expanded {
      grid-column: 1 / -1;
      order: 2;
    }

    &:not(.is-expanded) {
      .access-detail-list,
      .access-trend-wrap {
        display: none;
      }

      .access-data-content {
        min-height: 170px;
        justify-content: center;
      }

      .access-pie-chart {
        flex-basis: 180px;
        height: 165px;
      }
    }

    .card-display-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .card-expand-button {
      width: 28px;
      height: 28px;
      padding: 0;
      color: #86909c;
    }

    .card-expand-button:hover {
      color: #165dff;
      background: #e8f3ff;
    }

    .access-data-title {
      font-weight: 600;
      color: #1d2129;
    }

    .access-data-content {
      display: flex;
      align-items: center;
      min-height: 220px;
      gap: 20px;
    }

    .access-pie-chart {
      flex: 0 0 220px;
      height: 210px;
    }

    .access-detail-list {
      flex: 0 0 250px;
      border-left: 1px solid #f0f0f0;
      padding-left: 20px;
    }

    .access-detail-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 62px 52px;
      gap: 8px;
      align-items: center;
      min-height: 38px;
      color: #4e5969;
      font-size: 13px;
    }

    .access-detail-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      i {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 8px;
        border-radius: 50%;
      }
    }

    .access-detail-count {
      color: #1d2129;
      text-align: right;
    }

    .access-detail-percent {
      color: #86909c;
      text-align: right;
    }

    .access-trend-wrap {
      flex: 1 1 auto;
      min-width: 0;
      height: 230px;
      position: relative;
    }

    .access-trend-chart {
      width: 100%;
      height: 100%;
    }

    .access-hover-detail {
      position: absolute;
      top: 42px;
      left: 50%;
      min-width: 210px;
      padding: 10px 12px;
      border: 1px solid #e5e6eb;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 6px 18px rgba(31, 35, 41, 0.14);
      color: #4e5969;
      pointer-events: none;
      transform: translateX(-50%);
      z-index: 3;
    }

    .access-hover-date {
      margin-bottom: 6px;
      color: #1d2129;
      font-size: 13px;
      font-weight: 600;
    }

    .access-hover-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      min-height: 24px;
      font-size: 12px;
    }

    .access-hover-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      i {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 6px;
        border-radius: 50%;
      }
    }

    .access-hover-row strong {
      color: #1d2129;
    }
  }

  @media (max-width: 1100px) {
    .stats-cards-layout {
      grid-template-columns: 1fr;
    }

    .access-data-card .access-data-content {
      flex-wrap: wrap;
    }

    .access-data-card .access-trend-wrap {
      flex-basis: 100%;
    }
  }
}
</style>
