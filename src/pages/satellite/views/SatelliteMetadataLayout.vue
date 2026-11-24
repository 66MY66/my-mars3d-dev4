<template>
  <div class="satellite-metadata-page">
    <div class="content-header">
      <div class="header-text">
        <div class="page-label">卫星遥感数据管理子系统 · 元数据管理</div>
      </div>
      <div class="header-actions">
        <a-button @click="exportMetadata">
          <ExportOutlined />
          导出
        </a-button>
        <a-button @click="refreshData">
          <ReloadOutlined />
          刷新
        </a-button>
      </div>
    </div>

    <!-- 搜索过滤 -->
    <a-card :bordered="false" class="filter-card">
      <a-form layout="inline">
        <a-form-item label="卫星型号">
          <a-select
            v-model:value="filters.satellite"
            placeholder="全部"
            style="width: 150px"
            allow-clear
          >
            <a-select-option value="GF-1">GF-1</a-select-option>
            <a-select-option value="GF-6">GF-6</a-select-option>
            <a-select-option value="Sentinel-1">Sentinel-1</a-select-option>
            <a-select-option value="Sentinel-2">Sentinel-2</a-select-option>
            <a-select-option value="Landsat-8">Landsat-8</a-select-option>
            <a-select-option value="AQUA">AQUA</a-select-option>
            <a-select-option value="NOAA-20">NOAA-20</a-select-option>
            <a-select-option value="SUOMI-NPP">SUOMI-NPP</a-select-option>
            <a-select-option value="FY-3D">FY-3D</a-select-option>
            <a-select-option value="FY-3Y">FY-3Y</a-select-option>
            <a-select-option value="FY-3F">FY-3F</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="数据类型">
          <a-select
            v-model:value="filters.dataType"
            placeholder="全部"
            style="width: 120px"
            allow-clear
          >
            <a-select-option value="光学">光学</a-select-option>
            <a-select-option value="SAR">SAR</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="获取时间">
          <a-range-picker v-model:value="filters.dateRange" format="YYYY-MM-DD" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="handleSearch">
            <SearchOutlined />
            查询
          </a-button>
          <a-button style="margin-left: 8px" @click="resetFilters">重置</a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <!-- 元数据列表 -->
    <a-card :bordered="false" class="table-card">
      <template #title>
        <FileTextOutlined /> 元数据列表
      </template>

      <a-table
        :columns="columns"
        :data-source="metadataList"
        :pagination="paginationConfig"
        :loading="loading"
        row-key="metadataId"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            <a-tag color="blue">{{ record.title }}</a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-badge
              :status="record.status === '已验证' ? 'success' : 'warning'"
              :text="record.status"
            />
          </template>
          <template v-else-if="column.key === 'operation'">
            <a @click="viewDetail(record)">详情</a>
            <a-divider type="vertical" />
            <a @click="editMetadata(record)">编辑</a>
            <a-divider type="vertical" />
            <a @click="validateMetadata(record)">验证</a>
            <a-divider type="vertical" />
            <a style="color: #f5222d" @click="deleteMetadata(record)">删除</a>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 编辑元数据对话框 -->
    <a-modal
      title="编辑元数据"
      :open="dialogVisible"
      :confirm-loading="confirmLoading"
      width="800px"
      @ok="handleSaveMetadata"
      @cancel="dialogVisible = false"
    >
      <a-form
        ref="metadataFormRef"
        :model="metadataForm"
        :rules="metadataRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
      >
        <a-form-item label="条目ID" name="metadataId">
          <a-input v-model:value="metadataForm.metadataId" disabled />
        </a-form-item>
        <a-form-item label="所属数据集" name="collectionId">
          <a-input v-model:value="metadataForm.collectionId" disabled />
        </a-form-item>
        <a-form-item label="标题" name="title">
          <a-input v-model:value="metadataForm.title" placeholder="请输入标题" />
        </a-form-item>
        <a-form-item label="卫星/平台" name="satellite">
          <a-input v-model:value="metadataForm.satellite" placeholder="如 GF-1 / Sentinel-2" />
        </a-form-item>
        <a-form-item label="分辨率(m)" name="resolution">
          <a-input-number
            v-model:value="metadataForm.resolution"
            :min="0"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="获取时间" name="acquisitionTime">
          <a-input v-model:value="metadataForm.acquisitionTime" placeholder="YYYY-MM-DDTHH:mm:ssZ" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script>
import { h } from "vue"
import { message, Modal, Badge } from "ant-design-vue"
import {
  ExportOutlined,
  ReloadOutlined,
  SearchOutlined,
  FileTextOutlined
} from "@ant-design/icons-vue"
import { downloadBlob, metadataApi } from "../api/services"

export default {
  name: "SatelliteMetadataLayout",
  components: {
    ExportOutlined,
    ReloadOutlined,
    SearchOutlined,
    FileTextOutlined,
    ABadge: Badge
  },
  data() {
    return {
      loading: false,
      confirmLoading: false,

      // 过滤条件
      filters: {
        satellite: undefined,
        dataType: undefined,
        dateRange: []
      },

      // 元数据列表
      metadataList: [],

      // 表格列
      columns: [
        { title: "条目ID", dataIndex: "metadataId", key: "metadataId", width: 200, ellipsis: true },
        { title: "标题", dataIndex: "title", key: "title", ellipsis: true },
        { title: "所属数据集", dataIndex: "collectionId", key: "collectionId", width: 160, ellipsis: true },
        { title: "分辨率", dataIndex: "resolution", key: "resolution", width: 90 },
        { title: "获取时间", dataIndex: "acquisitionTime", key: "acquisitionTime", width: 180 },
        { title: "覆盖区域(bbox)", dataIndex: "region", key: "region", width: 220, ellipsis: true },
        { title: "状态", dataIndex: "status", key: "status", width: 100 },
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

      // 表单
      dialogVisible: false,
      metadataForm: {
        metadataId: "",
        collectionId: "",
        title: "",
        satellite: "",
        resolution: null,
        acquisitionTime: ""
      },
      metadataRules: {
        title: [{ required: true, message: "请输入标题", trigger: "blur" }]
      }
    }
  },
  mounted() {
    this.loadMetadata()
  },
  methods: {
    async loadMetadata(showSuccess = false) {
      this.loading = true
      try {
        const page = await metadataApi.list({
          pageNo: this.paginationConfig.current,
          pageSize: this.paginationConfig.pageSize,
          satellite: this.filters.satellite,
          dataType: this.filters.dataType,
          dateRange: this.filters.dateRange
        })
        this.metadataList = page.records
        this.paginationConfig.total = page.total
        if (showSuccess) { message.success("数据已刷新") }
      } catch (error) {
        message.error(error instanceof Error ? error.message : "元数据加载失败")
      } finally {
        this.loading = false
      }
    },
    refreshData() {
      this.loadMetadata(true)
    },

    handleSearch() {
      this.paginationConfig.current = 1
      this.loadMetadata(true)
    },

    resetFilters() {
      this.filters = {
        satellite: undefined,
        dataType: undefined,
        dateRange: []
      }
      this.paginationConfig.current = 1
      this.loadMetadata()
    },

    handleTableChange(pagination) {
      this.paginationConfig.current = pagination.current
      this.paginationConfig.pageSize = pagination.pageSize
      this.loadMetadata()
    },

    async exportMetadata() {
      try {
        const blob = await metadataApi.exportExcel()
        downloadBlob(blob, "metadata_export.xlsx")
        message.success("导出成功！文件保存为 metadata_export.xlsx")
      } catch (error) {
        message.error(error instanceof Error ? error.message : "导出失败")
      }
    },

    async handleSaveMetadata() {
      try {
        await this.$refs.metadataFormRef.validate()
        this.confirmLoading = true
        await metadataApi.edit({ ...this.metadataForm, id: `${this.metadataForm.collectionId}/${this.metadataForm.metadataId}` })
        message.success("元数据已保存")
        this.dialogVisible = false
        this.$refs.metadataFormRef.resetFields()
        await this.loadMetadata()
      } catch (error) {
        if (error instanceof Error) { message.error(error.message) }
      } finally {
        this.confirmLoading = false
      }
    },

    viewDetail(record) {
      Modal.info({
        title: "元数据详情",
        content: () =>
          h("div", [
            h("p", [h("strong", "条目ID："), record.metadataId]),
            h("p", [h("strong", "标题："), record.title]),
            h("p", [h("strong", "所属数据集："), record.collectionId]),
            h("p", [h("strong", "分辨率："), `${record.resolution}`]),
            h("p", [h("strong", "获取时间："), record.acquisitionTime]),
            h("p", [h("strong", "覆盖区域："), record.region])
          ]),
        okText: "关闭"
      })
    },

    editMetadata(record) {
      this.metadataForm = { ...record }
      this.dialogVisible = true
    },

    async validateMetadata(record) {
      try {
        const { valid, missing } = await metadataApi.validate(record)
        if (valid) {
          message.success(`元数据验证通过：${record.metadataId}`)
        } else {
          message.warning(`元数据验证未通过，缺失字段：${missing.join("、")}`)
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : "元数据验证失败")
      }
    },

    deleteMetadata(record) {
      Modal.confirm({
        title: "确定要删除该元数据吗？",
        content: "元数据由数据集版本自动生成，如需删除请到数据集管理删除对应数据集",
        okText: "确定",
        cancelText: "取消",
        onOk: async () => {
          try {
            await metadataApi.remove(record.metadataId)
            message.success("删除成功")
            await this.loadMetadata()
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
.satellite-metadata-page {
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

  .filter-card {
    margin-bottom: 16px;
  }

  .table-card {
    margin-top: 16px;
  }
}
</style>
