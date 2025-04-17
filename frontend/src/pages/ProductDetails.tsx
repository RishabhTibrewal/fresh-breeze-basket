
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Flag, Truck, ShoppingCart, Heart, Minus, Plus, ArrowLeft } from 'lucide-react';
import { getProductBySlug, getProductsByCategory } from '@/data/productData';
import ProductCard from '@/components/products/ProductCard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/contexts/CartContext';

const ProductDetails = () => {
  const { slug } = useParams<{ slug: string }>();
  const product = getProductBySlug(slug || '');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const { addToCart } = useCart();

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
            <p className="mb-6">Sorry, the product you are looking for does not exist.</p>
            <Link to="/products" className="btn-primary">
              Continue Shopping
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Get related products
  const relatedProducts = getProductsByCategory(product.categoryId)
    .filter(p => p.id !== product.id)
    .slice(0, 4);

  // Handle quantity change
  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const increaseQuantity = () => {
    if (quantity < product.stockCount) {
      setQuantity(quantity + 1);
    }
  };

  // Handle add to cart
  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumbs */}
          <div className="mb-6">
            <Link to="/products" className="flex items-center text-primary hover:underline">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Products
            </Link>
          </div>

          {/* Product Details */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Product Images */}
              <div>
                <div className="rounded-lg overflow-hidden mb-4 h-80 md:h-96 bg-gray-50">
                  <img 
                    src={product.images[activeImage]} 
                    alt={product.name} 
                    className="w-full h-full object-contain"
                  />
                </div>
                
                {product.images.length > 1 && (
                  <div className="flex space-x-2">
                    {product.images.map((image, index) => (
                      <button 
                        key={index}
                        onClick={() => setActiveImage(index)}
                        className={`w-20 h-20 rounded-md overflow-hidden border-2 ${
                          activeImage === index ? 'border-primary' : 'border-transparent'
                        }`}
                      >
                        <img 
                          src={image} 
                          alt={`${product.name} - view ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Product Info */}
              <div>
                {product.badge && (
                  <div className={`inline-block py-1 px-3 text-white text-xs font-semibold rounded-full mb-3 ${
                    product.badge === 'sale' ? 'bg-accent-sale' : 
                    product.badge === 'new' ? 'bg-accent' : 
                    product.badge === 'best-seller' ? 'bg-primary' : 
                    'bg-accent-special'
                  }`}>
                    {product.badge === 'sale' ? 'SALE' : 
                     product.badge === 'new' ? 'NEW' : 
                     product.badge === 'best-seller' ? 'BEST SELLER' : 
                     'ORGANIC'}
                  </div>
                )}
                
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{product.name}</h1>
                
                <div className="flex items-center mb-4">
                  <Flag className="h-4 w-4 mr-1 text-gray-500" />
                  <span className="text-gray-600">Origin: {product.origin}</span>
                </div>
                
                <div className="flex items-baseline mb-6">
                  {product.salePrice ? (
                    <>
                      <span className="text-accent-sale font-bold text-2xl md:text-3xl">AED {product.salePrice.toFixed(2)}</span>
                      <span className="ml-3 text-gray-500 line-through text-lg">AED {product.price.toFixed(2)}</span>
                    </>
                  ) : (
                    <span className="font-bold text-2xl md:text-3xl">AED {product.price.toFixed(2)}</span>
                  )}
                  <span className="ml-2 text-gray-600">/{product.unit}</span>
                </div>
                
                <div className="mb-6">
                  <p className="text-gray-700 mb-4">{product.description}</p>
                  
                  <h3 className="font-semibold text-lg mb-2">Nutritional Highlights:</h3>
                  <p className="text-gray-700 mb-4">{product.nutritionalInfo}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <div className="flex items-center text-sm bg-green-50 text-primary px-3 py-1 rounded-full">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>Harvested: {product.harvestDate}</span>
                    </div>
                    <div className="flex items-center text-sm bg-orange-50 text-orange-600 px-3 py-1 rounded-full">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>Best Before: {product.bestBefore}</span>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center border rounded-md">
                      <button 
                        onClick={decreaseQuantity}
                        className="px-3 py-2 text-gray-600 hover:bg-gray-100"
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="px-4 py-2 border-l border-r">{quantity}</span>
                      <button 
                        onClick={increaseQuantity}
                        className="px-3 py-2 text-gray-600 hover:bg-gray-100"
                        disabled={quantity >= product.stockCount}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      {product.stockCount > 10 ? (
                        <span className="text-green-600">In Stock</span>
                      ) : product.stockCount > 0 ? (
                        <span className="text-orange-600">Only {product.stockCount} left</span>
                      ) : (
                        <span className="text-red-600">Out of Stock</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={handleAddToCart}
                      className="flex-1 btn-primary flex items-center justify-center"
                      disabled={product.stockCount === 0}
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Add to Cart
                    </button>
                    <button className="flex items-center justify-center px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                      <Heart className="h-5 w-5" />
                    </button>
                  </div>
                  
                  <div className="mt-6 flex items-center text-gray-600">
                    <Truck className="h-5 w-5 mr-2" />
                    <span>Free delivery for orders over AED 100</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="mb-10">
              <h2 className="section-title mb-6">You May Also Like</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {relatedProducts.map((relatedProduct) => (
                  <ProductCard key={relatedProduct.id} product={relatedProduct} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductDetails;
