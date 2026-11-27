<template>
  <div class="satellite-data-pool-page">
    <div class="content-header">
      <div class="header-text">
        <div class="page-label">卫星遥感数据管理子系统 · 数据资源池管理</div>
      </div>
      <div class="header-actions">
        <a-button @click="refreshData">
          <ReloadOutlined />
          刷新
        </a-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <a-row v-if="false" :gutter="16" style="margin-bottom: 16px">
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

    <div class="mini-stats-cards-layout">
      <a-card v-for="card in miniCards" :key="card.key" :bordered="false" class="mini-stats-card">
        <template #title>{{ card.title }}</template>
        <template #extra>
          <a-radio-group :value="card.period" size="small" button-style="solid" @change="(event) => handleMiniPeriodChange(card.key, event)">
            <a-radio-button value="month">月周期</a-radio-button>
            <a-radio-button value="week">周周期</a-radio-button>
          </a-radio-group>
        </template>
        <div class="mini-period-range">{{ periodRangeText(card.period) }}</div>
        <div class="mini-stats-content">
          <div class="mini-pie-chart" :style="{ background: pieStyle(card.categories) }"><span /></div>
          <div class="mini-detail-list">
            <div v-for="item in card.categories" :key="item.name" class="mini-detail-row">
              <span class="mini-detail-name"><i :style="{ backgroundColor: item.color }" />{{ item.name }}</span>
              <span>{{ item.count }}</span>
              <span class="mini-detail-percent">{{ item.percent }}%</span>
            </div>
          </div>
        </div>
      </a-card>
    </div>

    <div class="stats-cards-layout">
    <a-card :bordered="false" :class="['access-data-card', { 'is-expanded': expandedCards.access }]">
      <template #title>
        <span class="access-data-title">接入数据</span>
      </template>
      <template #extra>
        <div class="card-display-actions">
          <a-button type="link" size="small" class="data-list-toggle" @click="toggleDataList('access')">
            数据列表
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
      <div v-if="dataListVisible.access" class="card-data-list">
        <div class="data-list-toolbar">
          <a-input-search v-model:value="dataListFilters.access.keyword" placeholder="搜索数据名称、来源" allow-clear style="width: 220px" @search="resetDataListPagination('access')" />
          <a-select v-model:value="dataListFilters.access.source" allow-clear placeholder="数据来源" style="width: 190px" @change="resetDataListPagination('access')">
            <a-select-option v-for="source in dataListSources" :key="source" :value="source">{{ source }}</a-select-option>
          </a-select>
          <a-range-picker v-model:value="dataListFilters.access.dateRange" value-format="YYYY-MM-DD" :disabled-date="(date) => isDateDisabled('access', date)" @change="resetDataListPagination('access')" />
          <a-select v-model:value="dataListFilters.access.format" allow-clear placeholder="数据格式" style="width: 140px" @change="resetDataListPagination('access')">
            <a-select-option v-for="format in dataListFormats.access" :key="format" :value="format">{{ format }}</a-select-option>
          </a-select>
        </div>
        <a-table
          size="small"
          :columns="dataListColumns.access"
          :data-source="filteredDataList.access"
          :pagination="dataListPagination.access"
          row-key="id"
          @change="(pagination) => handleDataListChange('access', pagination)"
        >
          <template #bodyCell="{ column, record }">
            <a v-if="column.key === 'operation'" @click="showDataDetail('access', record)">查看详情</a>
          </template>
        </a-table>
      </div>
    </a-card>

    <!-- 资源池列表 -->
    <a-card :bordered="false" :class="['access-data-card', 'output-data-card', { 'is-expanded': expandedCards.output }]">
      <template #title>
        <span class="access-data-title">产出情况分布</span>
      </template>
      <template #extra>
        <div class="card-display-actions">
          <a-button type="link" size="small" class="data-list-toggle" @click="toggleDataList('output')">
            数据列表
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
      <div v-if="dataListVisible.output" class="card-data-list">
        <div class="data-list-toolbar">
          <a-input-search v-model:value="dataListFilters.output.keyword" placeholder="搜索数据名称、模块" allow-clear style="width: 220px" @search="resetDataListPagination('output')" />
          <a-select v-model:value="dataListFilters.output.subsystem" allow-clear placeholder="所属子系统" style="width: 220px" @change="resetDataListPagination('output')">
            <a-select-option v-for="subsystem in outputSubsystems" :key="subsystem" :value="subsystem">{{ subsystem }}</a-select-option>
          </a-select>
          <a-range-picker v-model:value="dataListFilters.output.dateRange" value-format="YYYY-MM-DD" :disabled-date="(date) => isDateDisabled('output', date)" @change="resetDataListPagination('output')" />
          <a-select v-model:value="dataListFilters.output.format" allow-clear placeholder="数据格式" style="width: 140px" @change="resetDataListPagination('output')">
            <a-select-option v-for="format in dataListFormats.output" :key="format" :value="format">{{ format }}</a-select-option>
          </a-select>
        </div>
        <a-table
          size="small"
          :columns="dataListColumns.output"
          :data-source="filteredDataList.output"
          :pagination="dataListPagination.output"
          row-key="id"
          @change="(pagination) => handleDataListChange('output', pagination)"
        >
          <template #bodyCell="{ column, record }">
            <a v-if="column.key === 'operation'" @click="showDataDetail('output', record)">查看详情</a>
          </template>
        </a-table>
      </div>
    </a-card>

    <a-card :bordered="false" :class="['access-data-card', 'output-data-card', { 'is-expanded': expandedCards.upload }]">
      <template #title>
        <span class="access-data-title">数据上传情况</span>
      </template>
      <template #extra>
        <div class="card-display-actions">
          <a-button type="link" size="small" class="data-list-toggle" @click="toggleDataList('upload')">
            数据列表
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
      <div v-if="dataListVisible.upload" class="card-data-list">
        <div class="data-list-toolbar">
          <a-input-search v-model:value="dataListFilters.upload.keyword" placeholder="搜索数据名称、来源" allow-clear style="width: 220px" @search="resetDataListPagination('upload')" />
          <a-select v-model:value="dataListFilters.upload.interactionObject" allow-clear placeholder="交互对象" style="width: 220px" @change="resetDataListPagination('upload')">
            <a-select-option v-for="item in interactionObjects" :key="item" :value="item">{{ item }}</a-select-option>
          </a-select>
          <a-range-picker v-model:value="dataListFilters.upload.dateRange" value-format="YYYY-MM-DD" :disabled-date="(date) => isDateDisabled('upload', date)" @change="resetDataListPagination('upload')" />
          <a-select v-model:value="dataListFilters.upload.format" allow-clear placeholder="数据格式" style="width: 140px" @change="resetDataListPagination('upload')">
            <a-select-option v-for="format in dataListFormats.upload" :key="format" :value="format">{{ format }}</a-select-option>
          </a-select>
        </div>
        <a-table
          size="small"
          :columns="dataListColumns.upload"
          :data-source="filteredDataList.upload"
          :pagination="dataListPagination.upload"
          row-key="id"
          @change="(pagination) => handleDataListChange('upload', pagination)"
        >
          <template #bodyCell="{ column, record }">
            <a v-if="column.key === 'operation'" @click="showDataDetail('upload', record)">查看详情</a>
          </template>
        </a-table>
      </div>
    </a-card>
    </div>

    <a-card v-if="false" :bordered="false" class="table-card">
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
  UploadOutlined,
  ReloadOutlined,
  DatabaseOutlined
} from "@ant-design/icons-vue"
import { fromPool, toPoolPayload } from "../api/adapters"
import { poolApi } from "../api/services"
import { uploadArtifact, smartUploadArtifact } from "@mars/widgets/basic/dataset-repository/services/eoapi-artifacts"
import { searchItems, createDataset, updateDatasetContent } from "@mars/widgets/basic/dataset-repository/services/eoapi-datasets"
import dayjs from "dayjs"
import * as echarts from "echarts"
import { buildAccessTrend, getAccessDateRange } from "../utils/access-data"

export default {
  name: "SatelliteDataPoolLayout",
  components: {
    UploadOutlined,
    ReloadOutlined,
    DatabaseOutlined,
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
        access: true,
        output: true,
        upload: true
      },
      dataListVisible: {
        access: false,
        output: false,
        upload: false
      },
      dataListColumns: {
        access: [
          { title: "数据名称", dataIndex: "name", key: "name", ellipsis: true },
          { title: "数据来源", dataIndex: "source", key: "source" },
          { title: "接入时间", dataIndex: "time", key: "time" },
          { title: "数据格式", dataIndex: "format", key: "format" },
          { title: "接入状态", dataIndex: "status", key: "status" },
          { title: "操作", key: "operation", width: 90 }
        ],
        output: [
          { title: "数据名称", dataIndex: "name", key: "name", ellipsis: true },
          { title: "所属子系统", dataIndex: "module", key: "module" },
          { title: "产出时间", dataIndex: "time", key: "time" },
          { title: "数据格式", dataIndex: "format", key: "format", ellipsis: true },
          { title: "是否发布", dataIndex: "sent", key: "sent" },
          { title: "操作", key: "operation", width: 90 }
        ],
        upload: [
          { title: "数据名称", dataIndex: "name", key: "name", ellipsis: true },
          { title: "产出来源", dataIndex: "source", key: "source" },
          { title: "交互对象", dataIndex: "interactionObject", key: "interactionObject" },
          { title: "上传时间", dataIndex: "time", key: "time" },
          { title: "文件大小", dataIndex: "size", key: "size" },
          { title: "上传状态", dataIndex: "status", key: "status" },
          { title: "操作", key: "operation", width: 90 }
        ]
      },
      dataListFilters: {
        access: { keyword: "", source: undefined, dateRange: null, format: undefined },
        output: { keyword: "", subsystem: undefined, dateRange: null, format: undefined },
        upload: { keyword: "", interactionObject: undefined, dateRange: null, format: undefined }
      },
      dataListSources: [],
      outputSubsystems: [],
      interactionObjects: [],
      dataListFormats: {
        access: [],
        output: [],
        upload: []
      },
      dataListPagination: {
        access: { current: 1, pageSize: 5, total: 0, showSizeChanger: true, pageSizeOptions: ["5", "10", "20"], showTotal: (total) => `共 ${total} 条数据` },
        output: { current: 1, pageSize: 5, total: 0, showSizeChanger: true, pageSizeOptions: ["5", "10", "20"], showTotal: (total) => `共 ${total} 条数据` },
        upload: { current: 1, pageSize: 5, total: 0, showSizeChanger: true, pageSizeOptions: ["5", "10", "20"], showTotal: (total) => `共 ${total} 条数据` }
      },
      dataListRecords: {
        access: { month: [], week: [] },
        output: { month: [], week: [] },
        upload: { month: [], week: [] }
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
        { name: "地面站卫星原始数据", color: "#5B8FF9", count: 0, percent: 0, daily: [], dailyMap: {} },
        { name: "卫星遥感标准产品", color: "#61DDAA", count: 0, percent: 0, daily: [], dailyMap: {} },
        { name: "热红外监测数据", color: "#65789B", count: 0, percent: 0, daily: [], dailyMap: {} },
        { name: "地震灾情与专题数据", color: "#F6BD16", count: 0, percent: 0, daily: [], dailyMap: {} }
      ],
      outputCategories: [
        { name: "卫星遥感标准数据", color: "#5B8FF9", count: 0, percent: 0, daily: [], dailyMap: {} },
        { name: "热红外异常监测成果", color: "#61DDAA", count: 0, percent: 0, daily: [], dailyMap: {} },
        { name: "灾情与评估报告", color: "#65789B", count: 0, percent: 0, daily: [], dailyMap: {} },
        { name: "空间专题与自定义成果", color: "#F6BD16", count: 0, percent: 0, daily: [], dailyMap: {} }
      ],
      uploadCategories: [
        { name: "地面站原始数据(L0)", color: "#5B8FF9", count: 0, percent: 0, daily: [], dailyMap: {} },
        { name: "地面站预处理成果(L1)", color: "#61DDAA", count: 0, percent: 0, daily: [], dailyMap: {} },
        { name: "自定义上传数据集", color: "#65789B", count: 0, percent: 0, daily: [], dailyMap: {} }
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
    this.loadOverviewStats()
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
    miniCards() {
      return [
        { key: "access", title: "接入数据", period: this.accessPeriod, categories: this.accessCategories },
        { key: "output", title: "产出情况分布", period: this.outputPeriod, categories: this.outputCategories },
        { key: "upload", title: "数据上传情况", period: this.uploadPeriod, categories: this.uploadCategories }
      ]
    },
    allDataList() {
      const result = {}
      for (const cardKey of ["access", "output", "upload"]) {
        const records = Object.values(this.dataListRecords[cardKey] || {}).flat()
        result[cardKey] = Array.from(new Map(records.map((record) => [record.id, record])).values())
      }
      return result
    },
    currentDataList() {
      return {
        access: this.allDataList.access,
        output: this.allDataList.output,
        upload: this.allDataList.upload
      }
    },
    filteredDataList() {
      const result = {}
      for (const cardKey of ["access", "output", "upload"]) {
        const filters = this.dataListFilters[cardKey]
        const [start, end] = filters.dateRange || []
        const keyword = String(filters.keyword || "").trim().toLowerCase()
        result[cardKey] = this.currentDataList[cardKey].filter((record) => {
          const searchable = Object.values(record).join(" ").toLowerCase()
          if (keyword && !searchable.includes(keyword)) { return false }
          if (filters.source && record.source !== filters.source) { return false }
          if (filters.subsystem && record.module !== filters.subsystem) { return false }
          if (filters.interactionObject && record.interactionObject !== filters.interactionObject) { return false }
          if (filters.format && record.format !== filters.format) { return false }
          if (start || end) {
            const recordDate = dayjs(record.time)
            if (!recordDate.isValid()) { return false }
            if (start && recordDate.isBefore(dayjs(start), "day")) { return false }
            if (end && recordDate.isAfter(dayjs(end), "day")) { return false }
          }
          return true
        })
      }
      return result
    },
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
  watch: {
    filteredDataList: {
      deep: true,
      immediate: true,
      handler(value) {
        for (const cardKey of ["access", "output", "upload"]) {
          this.dataListPagination[cardKey].total = value[cardKey].length
        }
      }
    }
  },
  methods: {
    periodRangeText(period) {
      const dates = getAccessDateRange(period, new Date(), "full")
      return `${dates[0]} - ${dates[dates.length - 1]}`
    },

    pieStyle(categories) {
      let offset = 0
      const stops = categories.map((item) => {
        const start = offset
        offset += Number(item.percent || 0)
        return `${item.color} ${start}% ${offset}%`
      })
      return `conic-gradient(${stops.join(", ")})`
    },

    handleMiniPeriodChange(cardKey, event) {
      const period = event.target.value
      if (cardKey === "access") {
        this.accessPeriod = period
        this.handleAccessPeriodChange()
      }
      if (cardKey === "output") {
        this.outputPeriod = period
        this.handleOutputPeriodChange()
      }
      if (cardKey === "upload") {
        this.uploadPeriod = period
        this.handleUploadPeriodChange()
      }
    },

    toggleCard(cardKey) {
      this.expandedCards[cardKey] = !this.expandedCards[cardKey]
      if (!this.expandedCards[cardKey]) {
        this.dataListVisible[cardKey] = false
      }
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
      this.resetDataListPagination("access")
      this.renderAccessCharts()
    },

    handleOutputPeriodChange() {
      this.resetDataListPagination("output")
      this.renderOutputCharts()
    },

    handleUploadPeriodChange() {
      this.resetDataListPagination("upload")
      this.renderUploadCharts()
    },

    toggleDataList(cardKey) {
      this.dataListVisible[cardKey] = !this.dataListVisible[cardKey]
      this.syncDataListPagination(cardKey)
    },

    resetDataListPagination(cardKey) {
      this.dataListPagination[cardKey].current = 1
      this.syncDataListPagination(cardKey)
    },

    syncDataListPagination(cardKey) {
      this.dataListPagination[cardKey].total = this.currentDataList[cardKey].length
    },

    handleDataListChange(cardKey, pagination) {
      this.dataListPagination[cardKey].current = pagination.current
      this.dataListPagination[cardKey].pageSize = pagination.pageSize
    },

    isDateDisabled(cardKey, date) {
      return false
    },

    showDataDetail(cardKey, record) {
      if (cardKey === "output") {
        this.showOutputDetail(record)
        return
      }
      const labels = {
        access: "接入数据详情",
        output: "产出数据详情",
        upload: "数据上传详情"
      }
      const fields = Object.entries(record).filter(([key]) => key !== "id")
      Modal.info({
        title: labels[cardKey],
        width: cardKey === "output" ? 820 : 560,
        okText: "关闭",
        /*
        content: () => h("div", { class: "data-detail-modal" }, fields.map(([key, value]) => h("p", [h("strong", `${key}：`), String(value ?? "-\")])))
      })
        */
        content: () => h("div", { class: ["data-detail-modal", cardKey === "output" ? "data-detail-modal--output" : ""] }, [
          cardKey === "output"
            ? h("div", { class: "data-detail-preview" }, [
                h("div", { class: "data-detail-preview-icon" }, "预览图"),
                h("span", "图像预览占位")
              ])
            : null,
          h("div", { class: "data-detail-fields" }, fields.map(([key, value]) =>
            h("p", { key }, [h("strong", `${key}：`), String(value ?? "-")])
          ))
        ])
      })
    },

    showOutputDetail(record) {
      const fields = Object.entries(record).filter(([key]) => key !== "id")
      Modal.info({
        title: "产出情况详情",
        width: 820,
        okText: "关闭",
        content: () => h("div", {
          style: {
            display: "grid",
            gridTemplateColumns: "280px minmax(0, 1fr)",
            gap: "20px",
            alignItems: "stretch",
            width: "100%"
          }
        }, [
          h("div", {
            "aria-label": "预览图占位区域",
            style: {
              minHeight: "250px",
              border: "1px solid #d9e2ef",
              borderRadius: "8px",
              background: "#eef4fb",
              color: "#8a97a8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontSize: "14px"
            }
          }),
          h("div", {
            style: {
              maxHeight: "300px",
              overflowY: "auto",
              paddingRight: "10px",
              minWidth: "0",
              color: "#1d2129"
            }
          }, fields.map(([key, value]) => h("p", {
            key,
            style: { margin: "0 0 12px", lineHeight: "1.6", wordBreak: "break-word" }
          }, [h("strong", { style: { marginRight: "6px" } }, `${key}：`), String(value ?? "-")])))
        ])
      })
    },

    renderAccessCharts() {
      if (!this.$refs.accessPieChart || !this.$refs.accessTrendChart) {
        return
      }
      const dates = getAccessDateRange(this.accessPeriod)
      const tooltipDatesForDaily = getAccessDateRange(this.accessPeriod, new Date(), "full")
      this.accessCategories.forEach((item) => {
        item.daily = tooltipDatesForDaily.map((d) => Number((item.dailyMap || {})[d] || 0))
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
      visibleCategories.forEach((item) => {
        item.daily = tooltipDates.map((d) => Number((item.dailyMap || {})[d] || 0))
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
      visibleCategories.forEach((item) => {
        item.daily = tooltipDates.map((d) => Number((item.dailyMap || {})[d] || 0))
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
          pageSize: Math.max(this.paginationConfig.pageSize, 100)
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
    async loadOverviewStats() {
      try {
        const stats = await poolApi.getOverviewStats()
        this.accessCategories = stats.accessCategories
        this.outputCategories = stats.outputCategories
        this.uploadCategories = stats.uploadCategories
        this.dataListRecords = stats.records
        const uniq = (rows, key) => Array.from(new Set((rows || []).map((r) => r[key]).filter(Boolean)))
        this.dataListSources = uniq(stats.records.access.month, "source")
        this.outputSubsystems = uniq(stats.records.output.month, "module")
        this.interactionObjects = uniq(stats.records.upload.month, "interactionObject")
        this.dataListFormats = {
          access: uniq(stats.records.access.month, "format"),
          output: uniq(stats.records.output.month, "format"),
          upload: uniq(stats.records.upload.month, "format")
        }
        this.$nextTick(() => {
          this.renderAccessCharts()
          this.renderOutputCharts()
          this.renderUploadCharts()
        })
      } catch (error) {
        console.error("Failed to load overview stats", error)
      }
    },
    refreshData() {
      this.loadPools(true)
      this.loadOverviewStats()
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
        const res = await searchItems({ limit: 1000 })
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

  .mini-stats-cards-layout {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .mini-stats-card {
    min-width: 0;
    border-radius: 6px;

    :deep(.ant-card-head) {
      min-height: 48px;
      padding: 0 14px;
    }

    :deep(.ant-card-body) {
      padding: 10px 14px 14px;
    }
  }

  .mini-period-range {
    margin-bottom: 8px;
    color: #86909c;
    font-size: 12px;
    text-align: right;
  }

  .mini-stats-content {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 150px;
  }

  .mini-pie-chart {
    display: grid;
    flex: 0 0 132px;
    width: 132px;
    height: 132px;
    place-items: center;
    border-radius: 50%;

    span {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: #fff;
    }
  }

  .mini-detail-list {
    flex: 1 1 auto;
    min-width: 0;
  }

  .mini-detail-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 42px 42px;
    gap: 4px;
    align-items: center;
    min-height: 32px;
    color: #4e5969;
    font-size: 12px;
  }

  .mini-detail-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    i {
      display: inline-block;
      width: 7px;
      height: 7px;
      margin-right: 6px;
      border-radius: 50%;
    }
  }

  .mini-detail-percent {
    color: #86909c;
    text-align: right;
  }

  .stats-cards-layout {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 16px;

    .card-display-actions > .ant-radio-group {
      display: none;
    }
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
      .access-trend-wrap {
        display: none;
      }

      .access-data-content {
        min-height: 170px;
        gap: 12px;
        justify-content: flex-start;
      }

      .access-pie-chart {
        flex: 0 0 150px;
        height: 165px;
      }

      .access-detail-list {
        flex: 1 1 auto;
        min-width: 0;
        padding-left: 12px;
      }

      .access-detail-row {
        grid-template-columns: minmax(0, 1fr) 44px 42px;
        gap: 4px;
        min-height: 34px;
        font-size: 12px;
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

    .data-list-toggle {
      height: 28px;
      padding: 0 4px;
      color: #165dff;
    }

    .data-list-toggle:hover {
      color: #0e42d2;
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

  .card-data-list {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid #f0f0f0;

      .data-list-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }

      :deep(.ant-table-wrapper) {
        width: 100%;
      }
    }
  }

  :global(.data-detail-modal) {
    color: #1d2129;

    p {
      margin: 0 0 10px;
      line-height: 1.6;
      word-break: break-word;
    }
  }

  :global(.data-detail-modal--output) {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 20px;
    align-items: stretch;

    .data-detail-preview {
      min-height: 250px;
      border: 1px dashed #b7c3d4;
      border-radius: 8px;
      background: #f7f9fc;
      color: #86909c;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .data-detail-preview-icon {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: #e8f3ff;
      color: #1677ff;
      font-size: 13px;
    }

    .data-detail-fields {
      max-height: 300px;
      overflow-y: auto;
      padding-right: 8px;
    }
  }

  @media (max-width: 640px) {
    :global(.data-detail-modal--output) {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1100px) {
    .mini-stats-cards-layout {
      grid-template-columns: 1fr;
    }

    .stats-cards-layout {
      grid-template-columns: 1fr;
    }

    .access-data-card .access-data-content {
      flex-wrap: wrap;
    }

    .access-data-card:not(.is-expanded) .access-data-content {
      flex-wrap: nowrap;
    }

    .access-data-card .access-trend-wrap {
      flex-basis: 100%;
    }
  }
}
</style>
