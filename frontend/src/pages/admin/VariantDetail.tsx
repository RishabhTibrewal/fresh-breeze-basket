import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, Package, DollarSign, Image as ImageIcon, Warehouse } from 'lucide-react';
import { variantsService } from '@/api/variants';
import { ProductVariant, ProductPrice } from '@/api/products';
import { pricesService } from '@/api/prices';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PriceDisplay } from '@/components/products/PriceDisplay';
import { StockDisplay } from '@/components/inventory/StockDisplay';
import { ResponsiveTable, Column } from '@/components/ui/ResponsiveTable';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function VariantDetail() {
  const { variantId, productId } = useParams<{ variantId: string; productId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('details');

  // Determine base path based on current location
  const basePath = location.pathname.startsWith('/inventory') ? '/inventory' : '/admin';

  const { data: variant, isLoading } = useQuery<ProductVariant>({
    queryKey: ['variant', variantId],
    queryFn: () => variantsService.getById(variantId!),
    enabled: !!variantId,
  });

  const { data: prices = [] } = useQuery<ProductPrice[]>({
    queryKey: ['variant-prices', variantId],
    queryFn: () => pricesService.getVariantPrices(variantId!),
    enabled: !!variantId && activeTab === 'prices',
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!variant) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Variant not found</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const priceColumns: Column<ProductPrice>[] = [
    {
      key: 'price_type',
      header: 'Type',
      render: (price) => <Badge variant="outline">{price.price_type}</Badge>,
    },
    {
      key: 'prices',
      header: 'Prices',
      render: (price) => (
        <PriceDisplay
          mrpPrice={price.mrp_price}
          salePrice={price.sale_price}
          size="sm"
        />
      ),
    },
    {
      key: 'valid_from',
      header: 'Valid From',
      render: (price) => format(new Date(price.valid_from), 'PPP'),
    },
    {
      key: 'valid_until',
      header: 'Valid Until',
      render: (price) => price.valid_until ? format(new Date(price.valid_until), 'PPP') : 'No expiry',
    },
  ];

  const renderPriceCard = (price: ProductPrice) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{price.price_type}</Badge>
            </div>
            <PriceDisplay
              mrpPrice={price.mrp_price}
              salePrice={price.sale_price}
              size="sm"
            />
            <div className="text-sm text-muted-foreground mt-2">
              Valid from: {format(new Date(price.valid_from), 'PPP')}
            </div>
            {price.valid_until && (
              <div className="text-sm text-muted-foreground">
                Valid until: {format(new Date(price.valid_until), 'PPP')}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => {
            if (productId) {
              navigate(`${basePath}/products/${productId}/variants`);
            } else {
              navigate(-1);
            }
          }}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">{variant.name}</h1>
            {variant.sku && (
              <p className="text-muted-foreground mt-1">SKU: {variant.sku}</p>
            )}
          </div>
          <Button
            onClick={() => navigate(`${basePath}/variants/${variantId}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="prices">Prices</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Variant Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1 flex gap-2">
                    <Badge variant={variant.is_active ? 'default' : 'secondary'}>
                      {variant.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {variant.is_featured && (
                      <Badge variant="outline">Featured</Badge>
                    )}
                    {variant.is_default && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                  </div>
                </div>
                {variant.sku && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">SKU</label>
                    <div className="mt-1 text-sm">{variant.sku}</div>
                  </div>
                )}
              </div>

              {variant.price && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Current Price</label>
                  <div className="mt-1">
                    <PriceDisplay
                      mrpPrice={variant.price.mrp_price}
                      salePrice={variant.price.sale_price}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {variant.unit !== null && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Unit</label>
                    <div className="mt-1 text-sm">{variant.unit} {variant.unit_type}</div>
                  </div>
                )}
                {variant.best_before && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Best Before</label>
                    <div className="mt-1 text-sm">{format(new Date(variant.best_before), 'PPP')}</div>
                  </div>
                )}
                {variant.hsn && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">HSN Code</label>
                    <div className="mt-1 text-sm">{variant.hsn}</div>
                  </div>
                )}
                {variant.badge && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Badge</label>
                    <div className="mt-1">
                      <Badge variant="outline">{variant.badge}</Badge>
                    </div>
                  </div>
                )}
              </div>

              {variant.brand && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Brand</label>
                  <div className="mt-1 text-sm">{variant.brand.name}</div>
                </div>
              )}

              {variant.tax && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tax</label>
                  <div className="mt-1 text-sm">{variant.tax.name} ({variant.tax.rate}%)</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prices" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Price History</h2>
            <Button onClick={() => navigate(`/admin/prices/new?variant_id=${variantId}`)}>
              Add Price
            </Button>
          </div>
          {prices.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No prices found. Add a price to get started.
              </CardContent>
            </Card>
          ) : (
            <ResponsiveTable
              columns={priceColumns}
              data={prices}
              renderCard={renderPriceCard}
              emptyMessage="No prices found"
            />
          )}
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Variant Images</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                // Main image from variant.image_url
                const mainImage = variant.image_url ? [variant.image_url] : [];
                // Additional images from variant_images array
                const additionalImages = variant.variant_images 
                  ? variant.variant_images
                      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                      .map(img => img.image_url)
                  : [];
                const allImages = [...mainImage, ...additionalImages];

                if (allImages.length > 0) {
                  return (
                    <div className="space-y-4">
                      {mainImage.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">Main Image</h3>
                          <div className="relative rounded-lg overflow-hidden border max-w-md">
                            <img
                              src={mainImage[0]}
                              alt={`${variant.name} - Main Image`}
                              className="w-full h-64 object-contain bg-gray-50"
                            />
                          </div>
                        </div>
                      )}
                      {additionalImages.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">Additional Images ({additionalImages.length})</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {additionalImages.map((imageUrl, index) => (
                              <div key={index} className="relative rounded-lg overflow-hidden border">
                                <img
                                  src={imageUrl}
                                  alt={`${variant.name} - Image ${index + 1}`}
                                  className="w-full h-48 object-contain bg-gray-50"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => navigate(`${basePath}/variants/${variantId}/edit`)}
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Manage Images
                      </Button>
                    </div>
                  );
                } else {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No images uploaded.</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => navigate(`${basePath}/variants/${variantId}/edit`)}
                      >
                        Add Images
                      </Button>
                    </div>
                  );
                }
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock Information</CardTitle>
            </CardHeader>
            <CardContent>
              {variant.product_id ? (
                <StockDisplay
                  productId={variant.product_id}
                  variantId={variant.id}
                  format="detailed"
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Product ID not available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

