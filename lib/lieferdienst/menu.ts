export interface MenuItem {
  id: string
  name: string
  category: 'main' | 'side' | 'drink' | 'dessert'
  price: number
  available: boolean
  allergies?: string[]
  station: string
}

export const allergies = [
  { code: 'A', name: 'Gluten', color: 'bg-amber-500' },
  { code: 'B', name: 'Krebstiere', color: 'bg-red-500' },
  { code: 'C', name: 'Eier', color: 'bg-yellow-500' },
  { code: 'D', name: 'Fisch', color: 'bg-blue-500' },
  { code: 'E', name: 'Erdnüsse', color: 'bg-orange-500' },
  { code: 'F', name: 'Soja', color: 'bg-green-500' },
  { code: 'G', name: 'Milch', color: 'bg-sky-500' },
  { code: 'H', name: 'Schalenfrüchte', color: 'bg-amber-600' },
  { code: 'L', name: 'Sellerie', color: 'bg-lime-500' },
  { code: 'M', name: 'Senf', color: 'bg-yellow-600' },
  { code: 'N', name: 'Sesam', color: 'bg-stone-500' },
  { code: 'O', name: 'Sulfite', color: 'bg-purple-500' },
  { code: 'P', name: 'Lupinen', color: 'bg-violet-500' },
  { code: 'R', name: 'Weichtiere', color: 'bg-pink-500' },
]

export const mockMenuItems: MenuItem[] = [
  { id: '1', name: 'Wiener Schnitzel', category: 'main', price: 18.90, available: true, allergies: ['A', 'C'], station: 'grill' },
  { id: '2', name: 'Tafelspitz', category: 'main', price: 22.50, available: true, allergies: ['L'], station: 'grill' },
  { id: '3', name: 'Rindsgulasch', category: 'main', price: 16.90, available: true, allergies: ['A', 'L'], station: 'grill' },
  { id: '4', name: 'Schweinebraten', category: 'main', price: 15.90, available: true, station: 'grill' },
  { id: '5', name: 'Käsespätzle', category: 'main', price: 13.90, available: true, allergies: ['A', 'C', 'G'], station: 'grill' },
  { id: '6', name: 'Zwiebelrostbraten', category: 'main', price: 24.90, available: false, allergies: ['A'], station: 'grill' },
  { id: '7', name: 'Currywurst', category: 'main', price: 9.90, available: true, allergies: ['M'], station: 'grill' },
  { id: '8', name: 'Grillhendl', category: 'main', price: 14.90, available: true, station: 'grill' },
  { id: '9', name: 'Backhendl', category: 'main', price: 15.90, available: true, allergies: ['A', 'C'], station: 'grill' },
  { id: '10', name: 'Leberkäs', category: 'main', price: 8.90, available: true, station: 'grill' },
  { id: '11', name: 'Pommes Frites', category: 'side', price: 4.50, available: true, station: 'salads' },
  { id: '12', name: 'Bratkartoffeln', category: 'side', price: 4.90, available: true, station: 'salads' },
  { id: '13', name: 'Kartoffelknödel', category: 'side', price: 4.50, available: true, allergies: ['A'], station: 'salads' },
  { id: '14', name: 'Semmelknödel', category: 'side', price: 4.50, available: true, allergies: ['A', 'C', 'G'], station: 'salads' },
  { id: '15', name: 'Rotkraut', category: 'side', price: 3.90, available: true, station: 'salads' },
  { id: '16', name: 'Beilagensalat', category: 'side', price: 4.90, available: true, allergies: ['M'], station: 'salads' },
  { id: '17', name: 'Krautsalat', category: 'side', price: 3.50, available: true, station: 'salads' },
  { id: '18', name: 'Cola 0.5l', category: 'drink', price: 3.50, available: true, station: 'drinks' },
  { id: '19', name: 'Apfelschorle', category: 'drink', price: 3.90, available: true, allergies: ['O'], station: 'drinks' },
  { id: '20', name: 'Weißbier 0.5l', category: 'drink', price: 4.50, available: true, allergies: ['A'], station: 'drinks' },
  { id: '21', name: 'Radler 0.5l', category: 'drink', price: 4.20, available: true, allergies: ['A'], station: 'drinks' },
  { id: '22', name: 'Mineralwasser', category: 'drink', price: 2.90, available: true, station: 'drinks' },
  { id: '23', name: 'Apfelstrudel', category: 'dessert', price: 6.90, available: true, allergies: ['A', 'C', 'G', 'H'], station: 'desserts' },
  { id: '24', name: 'Kaiserschmarrn', category: 'dessert', price: 9.90, available: true, allergies: ['A', 'C', 'G'], station: 'desserts' },
  { id: '25', name: 'Sachertorte', category: 'dessert', price: 5.90, available: true, allergies: ['A', 'C', 'G', 'F'], station: 'desserts' },
  { id: '26', name: 'Germknödel', category: 'dessert', price: 7.90, available: true, allergies: ['A', 'C', 'G'], station: 'desserts' },
]

export function getAllergyInfo(code: string) {
  return allergies.find(a => a.code === code)
}
