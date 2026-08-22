# Mise Loyalty System

## Admin Workflow
1. Go to /admin/loyalty
2. Click "Neues Programm"
3. Fill program details and activate

## Customer Workflow
1. Add items to cart
2. See bonus banner if eligible
3. Click to select free item
4. Free item in checkout with 0.00 price

## Tables
- loyalty_programs: Program config
- loyalty_program_rules: Conditions
- loyalty_program_items: Free products
- loyalty_redemptions: Audit trail

## API Endpoints
- POST /api/loyalty/eligibility
- POST /api/loyalty/redeem
- PUT /api/loyalty/programs/{id}
- DELETE /api/loyalty/programs/{id}
