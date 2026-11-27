<template>
  <div class="satellite-share-page">
    <div class="content-header">
      <div class="header-text">
        <div class="page-label">卫星遥感数据管理子系统 · 数据共享访问</div>
      </div>
    </div>

    <!-- 选项卡 -->
    <a-tabs v-model:activeKey="activeTab" type="card">
      <!-- 我的共享 -->
      <a-tab-pane key="myshare" tab="我的共享">
        <a-card :bordered="false" style="margin-top: 0">
          <template #title>
            <FolderOpenOutlined /> 我分享的数据
          </template>

          <template #extra>
            <div class="share-toolbar">
              <a-button type="primary" @click="showShareDataDialog">
                <ShareAltOutlined />
                分享数据
              </a-button>
              <a-input-search v-model:value="myShareFilters.keyword" placeholder="搜索数据集名称或描述" allow-clear style="width: 220px" />
              <a-range-picker v-model:value="myShareFilters.dateRange" value-format="YYYY-MM-DD" />
              <a-select v-model:value="myShareFilters.format" placeholder="数据格式" allow-clear style="width: 140px">
                <a-select-option v-for="format in myShareFormats" :key="format" :value="format">{{ format }}</a-select-option>
              </a-select>
            </div>
          </template>

          <a-table
            :columns="myShareColumns"
            :data-source="filteredMySharedData"
            :loading="loading"
            row-key="dataId"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'createdAt'">
                {{ formatShareDate(record.createdAt) }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="shareStatusColor(record.status)" size="small">
                  {{ shareStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'operation'">
                <a @click="viewShareDetail(record)">详情</a>
                <a-divider type="vertical" />
                <a @click="editShare(record)">编辑</a>
                <a-divider type="vertical" />
                <a style="color: #f5222d" @click="deleteShare(record)">删除</a>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>

      <!-- 共享给我的 -->
      <a-tab-pane key="sharedtome" tab="共享给我的">
        <a-card :bordered="false">
          <template #title>
            <InboxOutlined /> 共享给我的数据
          </template>
          <template #extra>
            <div class="share-toolbar">
              <a-input-search v-model:value="sharedToMeFilters.keyword" placeholder="搜索数据集名称或描述" allow-clear style="width: 220px" />
              <a-range-picker v-model:value="sharedToMeFilters.dateRange" value-format="YYYY-MM-DD" />
              <a-select v-model:value="sharedToMeFilters.format" placeholder="数据格式" allow-clear style="width: 140px">
                <a-select-option v-for="format in sharedToMeFormats" :key="format" :value="format">{{ format }}</a-select-option>
              </a-select>
            </div>
          </template>

          <a-table
            :columns="sharedToMeColumns"
            :data-source="filteredSharedToMeData"
            :loading="loading"
            row-key="dataId"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'createdAt'">
                {{ formatShareDate(record.createdAt) }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.status === '共享' ? 'green' : 'orange'" size="small">
                  {{ record.status }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'operation'">
                <a @click="viewSharedToMeDetail(record)">详情</a>
                <a-divider type="vertical" />
                <a @click="useSharedData(record)">使用</a>
                <a-divider type="vertical" />
                <a style="color: #f5222d" @click="deleteSharedToMe(record)">删除</a>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>

      <!-- 访问监控 -->
      <a-tab-pane key="monitor" tab="访问监控">
        <!-- 访问日志 -->
        <a-card :bordered="false">
          <template #title>
            <FileTextOutlined /> 访问日志
          </template>
          <template #extra>
            <a-button type="link" @click="exportAccessLogs">导出日志</a-button>
          </template>

          <a-form layout="inline" style="margin-bottom: 16px">
            <a-form-item>
              <a-input-search v-model:value="logFilter.keyword" placeholder="搜索数据集名称或描述" allow-clear style="width: 220px" />
            </a-form-item>
            <a-form-item>
              <a-range-picker v-model:value="logFilter.dateRange" value-format="YYYY-MM-DD" />
            </a-form-item>
            <a-form-item>
              <a-select v-model:value="logFilter.format" placeholder="数据格式" style="width: 140px" allow-clear>
                <a-select-option v-for="format in sharedToMeFormats" :key="format" :value="format">{{ format }}</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item>
              <a-select v-model:value="logFilter.status" placeholder="共享状态" style="width: 120px" allow-clear>
                <a-select-option value="共享">共享</a-select-option>
                <a-select-option value="私人">私人</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="filterAccessLogs">查询</a-button>
              <a-button style="margin-left: 8px" @click="resetLogFilter">重置</a-button>
            </a-form-item>
          </a-form>

          <a-table
            :columns="logColumns"
            :data-source="filteredAccessLogs"
            :pagination="logPaginationConfig"
            :loading="loading"
            row-key="dataId"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === '共享' ? 'green' : 'orange'" size="small">
                  {{ record.status }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'createdAt'">
                {{ formatShareDate(record.createdAt) }}
              </template>
              <template v-else-if="column.key === 'operation'">
                <a @click="viewShareDetail(record)">详情</a>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <!-- 分享数据对话框 -->
    <a-modal
      title="分享数据"
      :open="statusEditDialogVisible"
      @ok="saveShareStatus"
      @cancel="statusEditDialogVisible = false"
    >
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="数据集">
          <span>{{ statusEditRecord?.dataName || "-" }}</span>
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="statusEditValue">
            <a-select-option value="私有">私有</a-select-option>
            <a-select-option value="共享">共享</a-select-option>
            <a-select-option value="审核中">审核中</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      :open="shareDialogVisible"
      :confirm-loading="confirmLoading"
      @ok="handleShareData"
      @cancel="shareDialogVisible = false"
    >
      <a-form :model="shareForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="选择数据">
          <a-select v-model:value="shareForm.dataId" placeholder="请选择数据">
            <a-select-option v-for="data in availableData" :key="data.id" :value="data.id">
              {{ data.name }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="分享类型">
          <a-radio-group v-model:value="shareForm.shareType">
            <a-radio value="public">公开分享</a-radio>
            <a-radio value="private">私密分享</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item v-if="shareForm.shareType === 'private'" label="接收人">
          <a-input v-model:value="shareForm.recipients" placeholder="输入用户ID或邮箱，多个用逗号分隔" />
        </a-form-item>

        <a-form-item label="有效期">
          <a-select v-model:value="shareForm.expireDays">
            <a-select-option :value="1">1天</a-select-option>
            <a-select-option :value="7">7天</a-select-option>
            <a-select-option :value="30">30天</a-select-option>
            <a-select-option :value="-1">永久</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script>
import { message, Modal } from "ant-design-vue"
import { useWidget } from "@mars/common/store/widget"
import { nextTick } from "vue"
import { useRouter } from "vue-router"
import {
  FileTextOutlined,
  ShareAltOutlined,
  FolderOpenOutlined,
  InboxOutlined
} from "@ant-design/icons-vue"
import { fromMetadata, toSharePayload } from "../api/adapters"
import { metadataApi, shareApi } from "../api/services"

export default {
  name: "SatelliteDataShareLayout",
  setup() {
    const { activate } = useWidget()
    const router = useRouter()
    async function openDatasetRepository(datasetId) {
      await router.push("/")
      await nextTick()
      activate({ name: "dataset-repository", data: { props: { restoreCollectionId: String(datasetId || "") } } })
    }
    return { openDatasetRepository }
  },
  components: {
    FileTextOutlined,
    ShareAltOutlined,
    FolderOpenOutlined,
    InboxOutlined
  },
  data() {
    return {
      loading: false,
      confirmLoading: false,
      activeTab: "myshare",

      logFilter: {
        keyword: "",
        dateRange: [],
        format: undefined,
        status: undefined
      },
      accessLogs: [],
      logColumns: [
        { title: "数据集名称", dataIndex: "dataName", key: "dataName", ellipsis: true },
        { title: "内容描述", dataIndex: "description", key: "description", ellipsis: true },
        { title: "共享状态", dataIndex: "status", key: "status", width: 100 },
        { title: "共享次数", dataIndex: "shareCount", key: "shareCount", width: 100 },
        { title: "下载次数", dataIndex: "downloadCount", key: "downloadCount", width: 100 },
        { title: "最近活动时间", dataIndex: "createdAt", key: "createdAt", width: 180 },
        { title: "操作", key: "operation", width: 90 }
      ],
      logPaginationConfig: {
        current: 1,
        pageSize: 10,
        total: 0,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条数据`
      },

      // 我的共享
      mySharedData: [],
      myShareFilters: { keyword: "", dateRange: [], format: undefined },
      myShareColumns: [
        { title: "数据集名称", dataIndex: "dataName", key: "dataName", ellipsis: true },
        { title: "内容描述", dataIndex: "description", key: "description", ellipsis: true },
        { title: "发布时间", dataIndex: "createdAt", key: "createdAt", width: 180 },
        { title: "状态", dataIndex: "status", key: "status", width: 100 },
        { title: "操作", key: "operation", fixed: "right", width: 180 }
      ],

      // 共享给我的
      sharedToMeData: [],
      sharedToMeFilters: { keyword: "", dateRange: [], format: undefined },
      sharedToMeColumns: [
        { title: "数据集名称", dataIndex: "dataName", key: "dataName", ellipsis: true },
        { title: "内容描述", dataIndex: "description", key: "description", ellipsis: true },
        { title: "导入时间", dataIndex: "createdAt", key: "createdAt", width: 180 },
        { title: "状态", dataIndex: "status", key: "status", width: 100 },
        { title: "操作", key: "operation", width: 180 }
      ],

      availableData: [],

      // 分享表单
      shareDialogVisible: false,
      shareForm: {
        dataId: "",
        shareType: "public",
        recipients: "",
        expireDays: 7
      },
      statusEditDialogVisible: false,
      statusEditRecord: null,
      statusEditValue: "私有"
    }
  },
  mounted() {
    this.loadAvailableData()
    this.loadMySharedData()
    this.loadSharedToMeData()
  },
  computed: {
    myShareFormats() {
      return Array.from(new Set(this.mySharedData.map((item) => item.format).filter(Boolean)))
    },
    sharedToMeFormats() {
      return Array.from(new Set(this.sharedToMeData.map((item) => item.format).filter(Boolean)))
    },
    filteredMySharedData() {
      const keyword = String(this.myShareFilters.keyword || "").trim().toLowerCase()
      const [start, end] = this.myShareFilters.dateRange || []
      return this.mySharedData.filter((item) => {
        const textMatch = !keyword || `${item.dataName || ""} ${item.description || ""}`.toLowerCase().includes(keyword)
        const date = this.safeDateKey(item.createdAt)
        const dateMatch = (!start || (date && date >= start)) && (!end || (date && date <= end))
        const formatMatch = !this.myShareFilters.format || item.format === this.myShareFilters.format
        return textMatch && dateMatch && formatMatch
      })
    },
    filteredSharedToMeData() {
      const keyword = String(this.sharedToMeFilters.keyword || "").trim().toLowerCase()
      const [start, end] = this.sharedToMeFilters.dateRange || []
      return this.sharedToMeData.filter((item) => {
        const textMatch = !keyword || `${item.dataName || ""} ${item.description || ""}`.toLowerCase().includes(keyword)
        const date = this.safeDateKey(item.createdAt)
        const dateMatch = (!start || (date && date >= start)) && (!end || (date && date <= end))
        const formatMatch = !this.sharedToMeFilters.format || item.format === this.sharedToMeFilters.format
        return textMatch && dateMatch && formatMatch
      })
    },
    filteredAccessLogs() {
      const keyword = String(this.logFilter.keyword || "").trim().toLowerCase()
      const [start, end] = this.logFilter.dateRange || []
      return this.accessLogs.filter((item) => {
        const textMatch = !keyword || `${item.dataName || ""} ${item.description || ""}`.toLowerCase().includes(keyword)
        const date = this.safeDateKey(item.createdAt)
        const dateMatch = (!start || (date && date >= start)) && (!end || (date && date <= end))
        const formatMatch = !this.logFilter.format || item.format === this.logFilter.format
        const statusMatch = !this.logFilter.status || item.status === this.logFilter.status
        return textMatch && dateMatch && formatMatch && statusMatch
      })
    }
  },
  methods: {
    safeDateKey(value) {
      if (!value) { return "" }
      const dt = new Date(value)
      return Number.isFinite(dt.getTime()) ? dt.toISOString().slice(0, 10) : ""
    },
    async loadSharedToMeData() {
      try {
        const page = await shareApi.list({ pageNo: 1, pageSize: 500 })
        this.sharedToMeData = page.records.map((record) => ({ ...record, status: record.shareType === "共享" ? "共享" : "私人" }))
      } catch (error) {
        message.error(error instanceof Error ? error.message : "共享给我的数据加载失败")
      }
    },
    async loadMySharedData() {
      this.loading = true
      try {
        const page = await shareApi.list({ pageNo: 1, pageSize: 500 })
        this.mySharedData = page.records.map((record) => ({ ...record, status: record.status === "未发布" ? "未发布" : record.shareType }))
        this.accessLogs = this.mySharedData.map((record) => ({
          ...record,
          shareCount: 1,
          downloadCount: Number(record.downloadCount || 0)
        }))
      } catch (error) {
        message.error(error instanceof Error ? error.message : "共享数据加载失败")
      } finally {
        this.loading = false
      }
    },
    formatShareDate(value) {
      if (!value) { return "-" }
      const dt = new Date(value)
      return Number.isFinite(dt.getTime()) ? dt.toLocaleString() : "-"
    },
    shareStatusText(status) {
      const value = String(status || "")
      if (value === "私有" || value === "私人" || value === "private") { return "私有" }
      if (value === "共享" || value === "public") { return "共享" }
      if (value === "审核中" || value === "未发布") { return "审核中" }
      return value || "私有"
    },
    shareStatusColor(status) {
      const label = this.shareStatusText(status)
      if (label === "共享") { return "green" }
      if (label === "审核中") { return "gold" }
      return "default"
    },
    viewShareDetail(record) {
      Modal.info({ title: "共享数据详情", content: `${record.dataName}：${record.description || "暂无描述"}`, okText: "关闭" })
    },
    editShare(record) {
      this.statusEditRecord = record
      this.statusEditValue = this.shareStatusText(record.status)
      this.statusEditDialogVisible = true
    },
    saveShareStatus() {
      if (!this.statusEditRecord) {
        this.statusEditDialogVisible = false
        return
      }
      const record = this.mySharedData.find((item) => item.dataId === this.statusEditRecord.dataId)
      if (record) {
        record.status = this.statusEditValue
        record.shareType = this.statusEditValue
      }
      this.statusEditDialogVisible = false
      message.success("共享状态已更新（当前页面）")
    },
    deleteShare(record) {
      Modal.confirm({
        title: "确定删除该共享数据吗？",
        okText: "删除",
        okType: "danger",
        cancelText: "取消",
        onOk: () => {
          this.mySharedData = this.mySharedData.filter((item) => item.dataId !== record.dataId)
          message.success("已从当前列表删除")
        }
      })
    },
    async loadAvailableData() {
      try {
        const page = await metadataApi.list({ pageNo: 1, pageSize: 1000 })
        this.availableData = page.records.map(fromMetadata).map((record) => ({
          id: record.metadataId,
          name: [record.satellite, record.sensor, record.region, record.acquisitionTime].filter(Boolean).join(" ")
        }))
      } catch (error) {
        message.error(error instanceof Error ? error.message : "可授权数据加载失败")
      }
    },
    filterAccessLogs() {
      this.logPaginationConfig.current = 1
    },

    resetLogFilter() {
      this.logFilter = {
        keyword: "",
        dateRange: [],
        format: undefined,
        status: undefined
      }
      this.logPaginationConfig.current = 1
    },

    exportAccessLogs() {
      message.info("操作审计按当前接入范围暂缓")
    },

    showShareDataDialog() {
      this.shareDialogVisible = true
    },

    async handleShareData() {
      if (!this.shareForm.dataId) {
        message.warning("请选择要分享的数据")
        return
      }
      try {
        this.confirmLoading = true
        const recipients = this.shareForm.recipients
          ? this.shareForm.recipients.split(",").map((item) => item.trim()).filter(Boolean)
          : ["公开"]
        await shareApi.add(toSharePayload({
          dataIds: [this.shareForm.dataId],
          authType: this.shareForm.shareType === "public" ? "公开" : "用户",
          authTarget: recipients,
          permissions: ["查看"],
          status: "已启用"
        }))
        message.success("数据分享成功")
        this.shareDialogVisible = false
      } catch (error) {
        message.error(error instanceof Error ? error.message : "数据分享失败")
      } finally {
        this.confirmLoading = false
      }
    },

    viewShareLink(record) {
      message.info(`项目一当前后端未提供分享链接接口：${record.shareId}`)
    },

    viewShareStats() {
      message.info("分享统计功能开发中...")
    },

    cancelShare(record) {
      Modal.confirm({
        title: "确定要取消分享吗？",
        okText: "确定",
        cancelText: "取消",
        onOk: () => {
          const index = this.mySharedData.findIndex((item) => item.shareId === record.shareId)
          if (index !== -1) {
            this.mySharedData.splice(index, 1)
            message.success("已取消分享")
          }
        }
      })
    },

    viewSharedToMeDetail(record) {
      Modal.info({ title: "共享数据详情", content: `${record.dataName}：${record.description || "暂无描述"}`, okText: "关闭" })
    },
    useSharedData(record) {
      this.openDatasetRepository(record.dataId)
    },
    deleteSharedToMe(record) {
      Modal.confirm({
        title: "确定删除该共享数据吗？",
        okText: "删除",
        okType: "danger",
        cancelText: "取消",
        onOk: () => {
          this.sharedToMeData = this.sharedToMeData.filter((item) => item.dataId !== record.dataId)
          message.success("已从当前列表删除")
        }
      })
    }
  }
}
</script>

<style scoped lang="less">
.satellite-share-page {
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
  }

  .share-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
}
</style>
