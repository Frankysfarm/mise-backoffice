import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { notFound } from 'next/navigation';
import { RecipeEditor } from './editor';
import { RecipeIngredients } from './ingredients';

export default async function RecipeDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireManagerPlus();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: recipe }, { data: allergens }, { data: ingredients }, { data: invItems }] = await Promise.all([
    supabase.from('recipes').select('*').eq('id', id).maybeSingle(),
    supabase.from('recipe_allergens').select('allergen,spuren').eq('recipe_id', id),
    supabase.from('recipe_ingredients').select('id,item_id,menge,einheit').eq('recipe_id', id),
    supabase.from('inventory_items').select('id,name,einheit,preis_pro_einheit').eq('aktiv', true).order('name'),
  ]);
  if (!recipe) notFound();
  return (
    <div className="space-y-6">
      <PageHeader backHref="/recipes" title={recipe.name} description="Zutaten, Zubereitung, Allergene, Food-Cost." />
      <RecipeIngredients recipeId={id} ingredients={(ingredients ?? []) as any[]} inventoryItems={(invItems ?? []) as any[]} />
      <RecipeEditor recipe={recipe} allergens={allergens ?? []} />
    </div>
  );
}
