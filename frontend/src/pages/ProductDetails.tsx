import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Flag, ShoppingCart, Heart, Minus, Plus, ArrowLeft } from 'lucide-react';
import { productsService } from '@/api/products';
import ProductCard from '@/components/products/ProductCard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/contexts/CartContext';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorMessage } from '@/components/ui/error-message';
import { toast } from '@/hooks/use-toast';

const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { state: cartState, addToCart, updateQuantity } = useCart();

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsService.getById(id || ''),
    enabled: !!id,
  });

  const cartItem = product ? cartState.items.find(item => item.id === product.id) : undefined;
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  useEffect(() => {
    if (product) {
      setQuantity(quantityInCart > 0 ? quantityInCart : 1);
    }
  }, [product, quantityInCart]);

  // Add console log to debug product data
  console.log('Product data:', product);
  console.log('Quantity in cart:', quantityInCart, 'Local quantity:', quantity);

  // Get related products - MODIFIED QUERY KEY
  const { data: allProductsForRelated, isLoading: isLoadingRelated } = useQuery({
    queryKey: ['products', 'allUnfilteredForRelated'], // Changed queryKey
    queryFn: productsService.getAll,
  });

  const relatedProducts = allProductsForRelated // Use the new data variable
    ?.filter(p => p.category_id === product?.category_id && p.id !== product?.id)
    .slice(0, 4);

  // Handle quantity change (for when item is NOT in cart, or for setting new quantity if it IS)
  const decreaseQuantity = () => {
    setQuantity(prev => Math.max(1, prev - 1));
  };

  const increaseQuantity = () => {
    const maxStock = product?.stock_count ?? 0;
    // If item is in cart, allow increasing up to stock_count
    // If item is NOT in cart, local quantity can go up to stock_count
    const limit = maxStock; 
    setQuantity(prev => Math.min(limit, prev + 1));
  };
  
  // Handle adding a new item to the cart
  const handleAddNewToCart = () => {
    if (product) {
      if (quantity <= 0) {
        toast({ title: "Invalid Quantity", description: "Please select a valid quantity.", variant: "destructive" });
        return;
      }
      if (quantity > product.stock_count) {
        toast({ title: "Not Enough Stock", description: `Only ${product.stock_count} items available.`, variant: "destructive" });
        setQuantity(product.stock_count); // Adjust to max available
        return;
      }
      addToCart(product, quantity);
      toast({ title: "Added to Cart", description: `${quantity} x ${product.name} added.`});
    }
  };

  // Handle updating quantity of an item ALREADY in the cart
  const handleUpdateCartQuantity = (newQuantity: number) => {
    if (product && cartItem) {
      if (newQuantity > product.stock_count) {
        toast({ title: "Not Enough Stock", description: `Only ${product.stock_count} items available.`, variant: "destructive" });
        updateQuantity(product.id, product.stock_count); // Update to max available
        return;
      }
      updateQuantity(product.id, newQuantity); // This will remove if newQuantity is 0
      if (newQuantity > 0) {
         toast({ title: "Cart Updated", description: `${product.name} quantity set to ${newQuantity}.`});
      } else {
         toast({ title: "Item Removed", description: `${product.name} removed from cart.`});
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <Skeleton className="h-96 rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24" />
              <Skeleton className="h-12" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-12">
          <ErrorMessage 
            title="Product Not Found" 
            message="Sorry, the product you are looking for does not exist." 
          />
          <Link to="/products" className="btn-primary mt-6 inline-block">
            Continue Shopping
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const mainImage = product.additional_images && product.additional_images.length > 0 
    ? product.additional_images[activeImageIndex]
    : product.image_url || '/placeholder.svg';

  // Determine max quantity for the input based on whether it's in cart or not
  const maxAllowedForInput = product ? product.stock_count : 0;

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
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
              {/* Product Images */}
              <div>
                <div className="relative rounded-lg overflow-hidden mb-4 aspect-[4/3] bg-gray-50">
                  <img 
                    src={mainImage} 
                    alt={product.name} 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                {product.additional_images && product.additional_images.length > 1 && (
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                    {product.additional_images.map((imageUrl, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveImageIndex(index)}
                        className={`relative rounded-lg overflow-hidden aspect-square ${
                          index === activeImageIndex ? 'ring-2 ring-primary' : ''
                        }`}
                      >
                        <img
                          src={imageUrl}
                          alt={`${product.name} - view ${index + 1}`}
                          className="absolute inset-0 w-full h-full object-cover hover:scale-110 transition-transform duration-200"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Product Info */}
              <div>
                {product.sale_price && (
                  <div className="inline-block bg-red-500 text-white text-sm font-medium px-3 py-1 rounded-full mb-2">
                    SALE
                  </div>
                )}
                <h1 className="text-2xl sm:text-3xl font-bold mb-3">{product.name}</h1>
                
                <div className="flex items-center mb-4">
                  <Flag className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-gray-600">Origin: {product.origin}</span>
                </div>
                
                <div className="flex flex-wrap items-baseline mb-6">
                  {product.sale_price ? (
                    <>
                      <span className="text-2xl sm:text-3xl font-bold text-red-500">AED {product.sale_price.toFixed(2)}</span>
                      <span className="ml-3 text-gray-500 line-through">AED {product.price.toFixed(2)}</span>
                      <span className="ml-2 text-gray-600">/{product.unit} {product.unit_type}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl sm:text-3xl font-bold">AED {product.price.toFixed(2)}</span>
                      <span className="ml-2 text-gray-600">/{product.unit} {product.unit_type}</span>
                    </>
                  )}
                </div>
                
                <p className="text-gray-700 mb-6">{product.description}</p>

                <div className="mb-6">
                  <h2 className="text-xl font-semibold mb-2">Nutritional Highlights:</h2>
                  <p className="text-gray-700">{product.nutritional_info}</p>
                </div>

                {/* Stock Availability Display */}
                <div className="mb-4 text-sm font-medium">
                  {product.stock_count > 10 ? (
                    <span className="text-green-600">In Stock</span>
                  ) : product.stock_count > 0 ? (
                    <span className="text-orange-500">{`Only ${product.stock_count} left - order soon!`}</span>
                  ) : (
                    <span className="text-red-600">Out of Stock</span>
                  )}
                </div>

                {product.stock_count > 0 && ( // Only show quantity/add to cart if in stock
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                    <div className="flex items-center border rounded-lg overflow-hidden">
                      <button
                        onClick={() => quantityInCart > 0 ? handleUpdateCartQuantity(quantityInCart - 1) : decreaseQuantity()}
                        className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 border-r"
                        disabled={(quantityInCart > 0 ? quantityInCart : quantity) <= (quantityInCart > 0 ? 0 : 1)} // Allow decreasing to 0 if in cart (to remove)
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-12 text-center text-lg tabular-nums">
                        {quantityInCart > 0 ? quantityInCart : quantity}
                      </span>
                      <button
                        onClick={() => quantityInCart > 0 ? handleUpdateCartQuantity(quantityInCart + 1) : increaseQuantity()}
                        className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 border-l"
                        disabled={(quantityInCart > 0 ? quantityInCart : quantity) >= maxAllowedForInput}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {quantityInCart === 0 && (
                      <button
                        onClick={handleAddNewToCart}
                        className="flex-1 bg-green-600 text-white py-3 sm:py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center text-sm"
                        disabled={!product.is_active || product.stock_count === 0 || quantity <= 0 || quantity > product.stock_count}
                      >
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        Add to Cart ({quantity})
                      </button>
                    )}
                  </div>
                )}
                
                {quantityInCart > 0 && product.stock_count > 0 && (
                   <p className="text-sm text-green-700 mb-6">This item is in your cart. Adjust quantity above.</p>
                )}
                
                {/* Fallback for out of stock */}
                {product.stock_count <= 0 && (
                  <div className="mb-6">
                     <button
                        className="flex-1 w-full bg-gray-400 text-white py-3 sm:py-2 rounded-lg font-medium cursor-not-allowed flex items-center justify-center text-sm"
                        disabled={true}
                      >
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        Out of Stock
                      </button>
                  </div>
                )}

                <div className="flex gap-3 mb-6"> {/* Ensure this div is present for the heart button */}
                  <button
                    className="w-12 sm:w-14 h-12 sm:h-14 flex items-center justify-center border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Heart className="h-5 sm:h-6 w-5 sm:w-6 text-gray-500" />
                  </button>
                </div>
                                
                <div className="mt-6 flex items-center text-gray-600">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Free delivery for orders over AED 100
                </div>
              </div>
            </div>
          </div>

          {/* Related Products */}
          {isLoadingRelated ? (
            <p>Loading related products...</p>
          ) : relatedProducts && relatedProducts.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Related Products</h2>
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