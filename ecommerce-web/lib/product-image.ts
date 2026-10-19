/** Keep the original image bounds when a product photo comes from Unsplash. */
export function uncroppedProductImage(src: string) {
  try {
    const url = new URL(src)
    if (url.hostname === 'images.unsplash.com' || url.hostname.endsWith('.images.unsplash.com')) {
      if (url.searchParams.get('fit') === 'crop') url.searchParams.set('fit', 'max')
      url.searchParams.delete('crop')
    }
    return url.toString()
  } catch {
    return src
  }
}
