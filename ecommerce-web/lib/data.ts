import type { Order, Product } from './types'

export const categories = ['Groceries', 'Vegetables', 'Fruits', 'Meat & fish', 'Bakery', 'Dairy', 'Frozen', 'Beverages', 'Personal care', 'Baby care', 'Cleaning', 'Kitchen', 'Electronics', 'Home appliances', 'Fashion', 'Sports', 'Stationery']

export const categorySlugMap: Record<string, string> = { groceries: 'Groceries', electronics: 'Electronics', 'personal-care': 'Personal care', home: 'Home appliances', 'home-appliances': 'Home appliances', fashion: 'Fashion', sports: 'Sports', vegetables: 'Vegetables', fruits: 'Fruits', bakery: 'Bakery', dairy: 'Dairy', 'dairy-eggs': 'Dairy', cleaning: 'Cleaning', kitchen: 'Kitchen', 'baby-care': 'Baby care' }
export function categoryFromSlug(slug: string) { return categorySlugMap[slug.trim().toLowerCase()] ?? slug.trim().replaceAll('-', ' ') }

export const products: Product[] = [
  { id: 1, name: 'Soundcore Life Q30 Hybrid Headphones', category: 'Electronics', price: 6999, oldPrice: 9999, rating: 4.7, reviews: 1842, badge: 'Best seller', color: 'blue', emoji: '🎧', imageUrl: 'https://images.unsplash.com/photo-1613629758552-443027994609?auto=format&fit=crop&w=900&q=85', stock: 42, sku: 'AUD-Q30-BLK', barcode: '0194649001234', brand: 'Soundcore', gst: 18, hsn: '85183000', variants: ['Black', 'Blue'], description: 'Hybrid active noise cancellation, 40-hour battery life and multipoint Bluetooth connection.' },
  { id: 2, name: 'AeroFlex Everyday Sneakers', category: 'Fashion', price: 1899, oldPrice: 3499, rating: 4.5, reviews: 892, badge: '32% off', color: 'sand', emoji: '👟', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85', stock: 68 },
  { id: 3, name: 'SmartBrew 1.5L Coffee Maker', category: 'Home appliances', price: 2499, oldPrice: 4299, rating: 4.6, reviews: 611, badge: 'Deal of the day', color: 'mint', emoji: '☕', imageUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=900&q=85', stock: 25 },
  { id: 4, name: 'NovaFit Active Smartwatch', category: 'Electronics', price: 3299, oldPrice: 5999, rating: 4.3, reviews: 1204, badge: 'Limited time', color: 'violet', emoji: '⌚', imageUrl: 'https://images.unsplash.com/photo-1624096104992-9b4fa3a279dd?auto=format&fit=crop&w=900&q=85', stock: 15 },
  { id: 5, name: 'Linen Lane Textured Throw', category: 'Home appliances', price: 799, oldPrice: 1299, rating: 4.8, reviews: 344, badge: 'Popular', color: 'peach', emoji: '🧺', imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=900&q=85', stock: 91 },
  { id: 6, name: 'Glow Theory Skin Essentials Kit', category: 'Personal care', price: 1299, oldPrice: 1999, rating: 4.4, reviews: 456, badge: 'New arrival', color: 'rose', emoji: '🧴', imageUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=85', stock: 33 },
  { id: 7, name: 'UrbanTrail Gym Duffel Bag', category: 'Sports', price: 999, oldPrice: 1599, rating: 4.6, reviews: 283, badge: 'Top rated', color: 'green', emoji: '🎒', imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85', stock: 54 },
  { id: 8, name: 'Daily Harvest Pantry Box', category: 'Groceries', price: 649, oldPrice: 799, rating: 4.2, reviews: 98, badge: 'Value pack', color: 'yellow', emoji: '🥫', imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=85', stock: 120, sku: 'GRC-PANTRY-01', barcode: '8901234567890', brand: 'Daily Harvest', gst: 5, hsn: '19059090', variants: ['Standard box', 'Family box'], description: 'A convenient everyday pantry selection with grains, staples and cooking essentials.' }
]

Object.assign(products[0], { gallery: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85', 'https://images.unsplash.com/photo-1583305727488-61f82c7eae4b?auto=format&fit=crop&w=900&q=85'], details: { material: 'ABS plastic, protein leather ear cushions', warranty: '18 months manufacturer warranty', origin: 'Imported', highlights: ['Hybrid active noise cancellation', '40-hour battery life', 'Multipoint Bluetooth'] } })
Object.assign(products[1], { gallery: ['https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=900&q=85'], details: { material: 'Mesh upper with rubber sole', warranty: '30-day manufacturing defect cover', origin: 'India', highlights: ['Lightweight cushioning', 'Breathable upper', 'Everyday walking fit'] } })
Object.assign(products[2], { details: { material: 'BPA-free plastic and stainless steel heating plate', warranty: '1 year manufacturer warranty', origin: 'India', highlights: ['1.5 litre capacity', 'Auto keep-warm function', 'Reusable filter'] } })
Object.assign(products[3], { details: { material: 'Aluminium case with silicone strap', warranty: '12 months manufacturer warranty', origin: 'Imported', highlights: ['Activity tracking', 'Heart-rate monitoring', 'Water resistant design'] } })
Object.assign(products[4], { details: { material: 'Cotton and linen blend', warranty: '30-day quality guarantee', origin: 'India', highlights: ['Machine washable', 'Soft textured finish', '130 cm by 170 cm'] } })
Object.assign(products[5], { details: { material: 'Dermatologically tested skincare formulas', expiry: 'See package for batch-specific expiry', origin: 'India', packSize: '3 piece kit', highlights: ['Cleanser', 'Moisturiser', 'Daily sunscreen'] } })
Object.assign(products[6], { details: { material: 'Water-resistant polyester', warranty: '6 months against manufacturing defects', origin: 'India', highlights: ['Separate shoe compartment', 'Adjustable shoulder strap', '45 litre capacity'] } })
Object.assign(products[7], { details: { expiry: 'Minimum 30 days shelf life at delivery', origin: 'India', packSize: 'Standard box', highlights: ['Rice and grains', 'Cooking staples', 'Pantry essentials'] } })
Object.assign(products[2], { imageUrl: 'https://images.unsplash.com/photo-1710594935133-17e492868934?auto=format&fit=crop&w=900&q=85', gallery: ['https://images.unsplash.com/photo-1519585969732-0d3e30255220?auto=format&fit=crop&w=900&q=85'], description: 'A 1.5 litre drip coffee maker with reusable filter, keep-warm plate and clear water tank.' })
Object.assign(products[3], { gallery: ['https://images.unsplash.com/photo-1660844817855-3ecc7ef21f12?auto=format&fit=crop&w=900&q=85', 'https://images.unsplash.com/photo-1675535350277-6fdb9948bfcb?auto=format&fit=crop&w=900&q=85'] })
Object.assign(products[4], { imageUrl: 'https://lmhome.com.au/cdn/shop/products/t_burton_oatmeal_5cc1064e-2619-47ba-a02f-c6a070c4659b.jpg?v=1619401684&width=1600', gallery: ['https://www.hawkinsnewyork.com/cdn/shop/products/0722207538_RT_1440x.jpg?v=1630529272'], description: 'A 130 cm by 170 cm oatmeal linen throw with a soft woven texture and fringed edge.' })
Object.assign(products[5], { imageUrl: 'https://artisanchemist.com.au/cdn/shop/files/glow-trio-2024.jpg?v=1732001023', gallery: ['https://images.unsplash.com/photo-1782034493928-d8410275cfcd?auto=format&fit=crop&w=900&q=85'], description: 'A three-piece daily skincare kit containing cleanser, niacinamide serum and moisturiser for a simple morning and evening routine.' })
Object.assign(products[6], { imageUrl: 'https://cdn.shopify.com/s/files/1/0156/6146/files/images-PowerHoldallGSDarkGreyI4A2J_GB7H_3013.jpg?v=1759483971', gallery: ['https://static.thcdn.com/productimg/original/14871982-1235106897065691.jpg'] })
Object.assign(products[7], { imageUrl: 'https://images.gastronom.ru/NXaPwyc8DjG5MgyND9XFDhJtAMRC1557_ggDx_EDfnM/pr%3Aarticle-cover-image/g%3Ace/rs%3Aauto%3A0%3A0%3A0/L2Ntcy9hbGwtaW1hZ2VzLzUwMTAxYWJlLTQ0YmQtNGYyZS1hN2RjLThhMDBiM2Y2OGExNy5wbmc.webp', gallery: ['https://images.unsplash.com/photo-1713911147447-de1a20bb8790?auto=format&fit=crop&w=900&q=85'], description: 'A standard pantry box with rice, lentils, oats, canned vegetables, pasta and cooking oil. Packed for everyday meals.' })

export const addresses = [
  { id: 1, label: 'Home', recipient: 'Priya Sharma', line: '14 Palm Avenue, Bandra West', city: 'Mumbai', postalCode: '400050', selected: true },
  { id: 2, label: 'Office', recipient: 'Priya Sharma', line: 'Tower B, One World Center', city: 'Mumbai', postalCode: '400013' }
]

export const orders: Order[] = [
  { id: '#CL-10482', customer: 'Priya Sharma', total: '₹2,499', status: 'Delivered', location: 'Bandra West, Mumbai' },
  { id: '#CL-10481', customer: 'Rohan Mehta', total: '₹6,999', status: 'Picking', location: 'Indiranagar, Bengaluru' },
  { id: '#CL-10480', customer: 'Aarav Kapoor', total: '₹1,899', status: 'Out for delivery', location: 'Gurugram, Haryana' },
  { id: '#CL-10479', customer: 'Meera Iyer', total: '₹799', status: 'Delivered', location: 'Adyar, Chennai' }
]

export const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
