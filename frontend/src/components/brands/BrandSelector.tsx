import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Building2, Check, X } from 'lucide-react';
import { brandsService, Brand } from '@/api/brands';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface BrandSelectorProps {
  selectedBrandId: string | null;
  onSelect: (brandId: string | null) => void;
  allowClear?: boolean;
  className?: string;
}

export const BrandSelector: React.FC<BrandSelectorProps> = ({
  selectedBrandId,
  onSelect,
  allowClear = true,
  className,
}) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: brands = [], isLoading } = useQuery<Brand[]>({
    queryKey: ['brands'],
    queryFn: brandsService.getAll,
  });

  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    brand.legal_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedBrand = brands.find(b => b.id === selectedBrandId);

  // Desktop: Use Command component in Popover for searchable selection
  if (!isMobile) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between', className)}
          >
            {selectedBrand ? (
              <div className="flex items-center gap-2">
                {selectedBrand.logo_url ? (
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={selectedBrand.logo_url} alt={selectedBrand.name} />
                    <AvatarFallback>
                      <Building2 className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                <span>{selectedBrand.name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Select brand...</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search brands..." />
            <CommandList>
              <CommandEmpty>No brand found.</CommandEmpty>
              <CommandGroup>
                {allowClear && (
                  <CommandItem
                    onSelect={() => {
                      onSelect(null);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <X className="h-4 w-4" />
                      <span>No Brand</span>
                      {!selectedBrandId && (
                        <Check className="ml-auto h-4 w-4" />
                      )}
                    </div>
                  </CommandItem>
                )}
                {filteredBrands.map((brand) => (
                  <CommandItem
                    key={brand.id}
                    value={brand.id}
                    onSelect={() => {
                      onSelect(brand.id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {brand.logo_url ? (
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={brand.logo_url} alt={brand.name} />
                          <AvatarFallback>
                            <Building2 className="h-3 w-3" />
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      <span className="flex-1">{brand.name}</span>
                      {selectedBrandId === brand.id && (
                        <Check className="h-4 w-4" />
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  // Mobile: Use Select component (simpler for mobile)
  return (
    <Select
      value={selectedBrandId || ''}
      onValueChange={(value) => onSelect(value || null)}
    >
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder="Select brand">
          {selectedBrand ? (
            <div className="flex items-center gap-2">
              {selectedBrand.logo_url ? (
                <Avatar className="h-5 w-5">
                  <AvatarImage src={selectedBrand.logo_url} alt={selectedBrand.name} />
                  <AvatarFallback>
                    <Building2 className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Building2 className="h-4 w-4" />
              )}
              <span>{selectedBrand.name}</span>
            </div>
          ) : (
            'Select brand'
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowClear && (
          <SelectItem value="">No Brand</SelectItem>
        )}
        {isLoading ? (
          <SelectItem value="" disabled>Loading...</SelectItem>
        ) : (
          filteredBrands.map((brand) => (
            <SelectItem key={brand.id} value={brand.id}>
              <div className="flex items-center gap-2">
                {brand.logo_url ? (
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={brand.logo_url} alt={brand.name} />
                    <AvatarFallback>
                      <Building2 className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                <span>{brand.name}</span>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
};

