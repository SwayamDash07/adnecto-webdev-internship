import Image from 'next/image'
import type { Product } from '@/types/catalog'

export function ProductVisual({ product }: { product: Product }) { return product.imageUrl ? <Image className="product-photo" src={product.imageUrl} alt={product.name} fill sizes="(max-width: 680px) 50vw, 25vw" /> : <span className="product-emoji">{product.emoji}</span> }
