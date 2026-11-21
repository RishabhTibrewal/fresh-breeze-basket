import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Search, X, ChevronRight } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../theme/theme';
import { apiClient } from '../api/client';
import { CATEGORIES, getCategoryEmoji } from './HomeScreen';

interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  image_url?: string;
  description?: string;
}

export const CategoriesScreen = ({ navigation }: any) => {
  const { width } = useWindowDimensions();
  const columns = width >= 768 ? 3 : 2;
  const cardWidth = (width - SPACING.md * 2 - SPACING.sm * (columns - 1)) / columns;

  const [categories, setCategories] = useState<CategoryItem[]>(CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await apiClient.get('/categories');
      const catList = Array.isArray(response.data)
        ? response.data
        : response.data?.data && Array.isArray(response.data.data)
        ? response.data.data
        : [];

      if (catList.length > 0) {
        const mapped: CategoryItem[] = [
          { id: 'all', name: 'All Products', icon: '🧺', description: 'Browse full catalog' },
          ...catList.map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            icon: getCategoryEmoji(cat.name),
            image_url: cat.image_url || undefined,
            description: cat.description || undefined,
          })),
        ];
        setCategories(mapped);
      }
    } catch (err) {
      console.log('Error fetching categories:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCategories();
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleSelectCategory = (categoryId: string) => {
    navigation.navigate('HomeTab', { selectedCategory: categoryId });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bgWhite} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Categories</Text>
        <Text style={styles.headerSubtitle}>Browse farm-fresh harvest by aisle</Text>

        <View style={styles.searchBar}>
          <Search color={COLORS.textSecondary} size={17} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search categories..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color={COLORS.textSecondary} size={15} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primaryDark]}
            tintColor={COLORS.primaryDark}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primaryDark} />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        ) : filteredCategories.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No categories found</Text>
            <Text style={styles.emptySubtitle}>Try a different search term.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredCategories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryCard, { width: cardWidth }]}
                activeOpacity={0.85}
                onPress={() => handleSelectCategory(cat.id)}
              >
                <View style={styles.iconWrapper}>
                  {cat.image_url ? (
                    <Image source={{ uri: cat.image_url }} style={styles.categoryImage} resizeMode="cover" />
                  ) : (
                    <Text style={styles.categoryEmoji}>{cat.icon}</Text>
                  )}
                </View>

                <Text style={styles.categoryName} numberOfLines={2}>
                  {cat.name}
                </Text>

                {cat.description ? (
                  <Text style={styles.categoryDesc} numberOfLines={1}>
                    {cat.description}
                  </Text>
                ) : null}

                <View style={styles.exploreRow}>
                  <Text style={styles.exploreText}>Explore</Text>
                  <ChevronRight color={COLORS.primaryDark} size={13} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgCanvas,
  },
  header: {
    backgroundColor: COLORS.bgWhite,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.card,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: SPACING.sm + 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCanvas,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textBody,
    fontWeight: '500',
    padding: 0,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 32,
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: COLORS.bgWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    marginTop: SPACING.md,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderGreen,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.card,
  },
  iconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.bgWhite,
    borderWidth: 1.5,
    borderColor: COLORS.borderGreen,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryEmoji: {
    fontSize: 30,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  categoryDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 3,
  },
  exploreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: 2,
  },
  exploreText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
});

