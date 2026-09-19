import type { Product } from '@/lib/types'
import { money } from '@/lib/data'

export function ProductTable({ products }: { products: Product[] }) {
  return <div className="panel table-panel"><div className="panel-heading"><div><h2>Product catalogue</h2><p>Manage simple, variable, loose-weight, combo, subscription and gift products.</p></div><button className="primary-button">+ Add product</button></div><div className="inventory-table"><div className="table-head"><span>Product</span><span>Category</span><span>Price</span><span>Stock</span><span>Status</span></div>{products.map(item => <div className="table-row" key={item.id}><span><strong>{item.emoji} {item.name}</strong></span><span>{item.category}</span><span>{money(item.price)}</span><span>{item.stock} units</span><span className={item.stock < 20 ? 'low-stock' : 'in-stock'}>{item.stock < 20 ? 'Low stock' : 'In stock'}</span></div>)}</div></div>
}
