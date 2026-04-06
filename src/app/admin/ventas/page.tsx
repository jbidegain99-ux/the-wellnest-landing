'use client'

import * as React from 'react'
import {
  Search,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Filter,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { formatPrice, formatDate } from '@/lib/utils'

interface Sale {
  id: string
  userEmail: string
  userName: string | null
  packageName: string
  amount: number
  createdAt: string
  status: string
  paymentMethod: string
  notes: string | null
}

interface PaginationData {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function AdminVentasPage() {
  const [sales, setSales] = React.useState<Sale[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [pagination, setPagination] = React.useState<PaginationData>({
    total: 0, page: 0, limit: 50, totalPages: 0,
  })

  // Filters
  const [searchQuery, setSearchQuery] = React.useState('')
  const [paymentMethod, setPaymentMethod] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [sortOrder, setSortOrder] = React.useState<'desc' | 'asc'>('desc')
  const [showFilters, setShowFilters] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)

  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const fetchSales = React.useCallback(async (page = 0) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        sortOrder,
      })
      if (searchQuery) params.append('search', searchQuery)
      if (paymentMethod) params.append('paymentMethod', paymentMethod)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/admin/sales?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSales(data.sales)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, paymentMethod, startDate, endDate, sortOrder])

  React.useEffect(() => {
    fetchSales(0)
  }, [fetchSales])

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      // fetchSales will be triggered by the useEffect when searchQuery changes
    }, 300)
  }

  const handleExportCSV = async () => {
    setIsExporting(true)
    try {
      // Fetch all sales matching current filters (no pagination limit)
      const params = new URLSearchParams({
        page: '0',
        limit: '10000',
        sortOrder,
      })
      if (searchQuery) params.append('search', searchQuery)
      if (paymentMethod) params.append('paymentMethod', paymentMethod)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/admin/sales?${params}`)
      if (!response.ok) return

      const data = await response.json()
      const allSales: Sale[] = data.sales

      // Build CSV
      const headers = ['ID', 'Email', 'Nombre', 'Paquete', 'Monto', 'Fecha', 'Estado', 'Metodo de Pago', 'Notas']
      const rows = allSales.map((s) => [
        s.id,
        s.userEmail,
        s.userName || '',
        s.packageName,
        s.amount.toFixed(2),
        new Date(s.createdAt).toLocaleString('es-SV', { timeZone: 'America/El_Salvador' }),
        s.status,
        s.paymentMethod,
        s.notes || '',
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const now = new Date()
      const filename = `wellnest_ventas_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.csv`

      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting CSV:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setPaymentMethod('')
    setStartDate('')
    setEndDate('')
  }

  const hasActiveFilters = searchQuery || paymentMethod || startDate || endDate

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Activo</Badge>
      case 'expired':
        return <Badge variant="warning">Expirado</Badge>
      case 'depleted':
        return <Badge variant="secondary">Agotado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Ventas
          </h1>
          <p className="text-gray-600 mt-1">
            Historial completo de ventas y compras
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          isLoading={isExporting}
        >
          <Download className="h-4 w-4 mr-2" />
          Descargar CSV
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Buscar por email, nombre o paquete..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              icon={<Search className="h-5 w-5" />}
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtros
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}
        </div>

        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">
                    Metodo de pago
                  </label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v === 'all' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="PayWay">PayWay</SelectItem>
                      <SelectItem value="Offline">Offline (Admin)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-11 w-full rounded-lg border border-beige-dark px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-11 w-full rounded-lg border border-beige-dark px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary */}
      {!isLoading && (
        <p className="text-sm text-gray-600">
          {pagination.total} venta{pagination.total !== 1 ? 's' : ''} encontrada{pagination.total !== 1 ? 's' : ''}
        </p>
      )}

      {/* Sales Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-beige">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Usuario
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Paquete
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Monto
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      <button
                        onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        Fecha
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Estado
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                      Pago
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-beige">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-beige/50 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            {sale.userName || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-gray-500">{sale.userEmail}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {sale.packageName}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-foreground">
                        {formatPrice(sale.amount)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(new Date(sale.createdAt))}
                      </td>
                      <td className="py-3 px-4">
                        {statusBadge(sale.status)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={sale.paymentMethod === 'PayWay' ? 'default' : 'outline'}>
                          {sale.paymentMethod}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {sales.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          No se encontraron ventas
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
          <p className="text-sm text-gray-600">
            Pagina <strong>{pagination.page + 1}</strong> de{' '}
            <strong>{pagination.totalPages}</strong> ({pagination.total} ventas)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 0}
              onClick={() => fetchSales(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages - 1}
              onClick={() => fetchSales(pagination.page + 1)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
