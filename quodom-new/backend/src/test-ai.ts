import { generateQuodomFromPrompt } from './services/aiService';
import prisma from './prisma';

async function runTests() {
  console.log('--- STARTING AI SERVICE VERIFICATION TESTS ---');

  // Ensure DB is not empty
  const productCount = await prisma.product.count();
  console.log(`Database has ${productCount} products.`);
  if (productCount === 0) {
    console.error('Error: Database has 0 products. Please seed the database first.');
    process.exit(1);
  }

  // Backup original env vars
  const origGemini = process.env.GEMINI_API_KEY;
  const origOpenAI = process.env.OPENAI_API_KEY;

  // Force local mock fallback
  process.env.GEMINI_API_KEY = '';
  process.env.OPENAI_API_KEY = '';

  let success = true;

  // Test Case 1: Paint Prompt
  try {
    console.log('\nTest Case 1: Paint Prompt ("Necesito pintar una pared con latex y rodillo")');
    const result = await generateQuodomFromPrompt('Necesito pintar una pared con latex y rodillo', 'dummy-user-id');
    console.log('Result:', JSON.stringify(result, null, 2));

    if (!result.title.includes('Pintura IA')) {
      throw new Error(`Title expected to contain "Pintura IA", got: "${result.title}"`);
    }
    if (result.items.length === 0) {
      throw new Error('Items list is empty');
    }
    for (const item of result.items) {
      if (typeof item.productId !== 'number' || item.productId <= 0) {
        throw new Error(`Invalid productId: ${item.productId}`);
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new Error(`Invalid quantity: ${item.quantity}`);
      }
    }
    console.log('Test Case 1: PASSED');
  } catch (err: any) {
    console.error('Test Case 1: FAILED with error:', err.message);
    success = false;
  }

  // Test Case 2: Drinks Prompt
  try {
    console.log('\nTest Case 2: Drinks Prompt ("Quiero comprar gaseosas y cervezas para un cumple")');
    const result = await generateQuodomFromPrompt('Quiero comprar gaseosas y cervezas para un cumple', 'dummy-user-id');
    console.log('Result:', JSON.stringify(result, null, 2));

    if (!result.title.includes('Bebidas IA')) {
      throw new Error(`Title expected to contain "Bebidas IA", got: "${result.title}"`);
    }
    if (result.items.length === 0) {
      throw new Error('Items list is empty');
    }
    console.log('Test Case 2: PASSED');
  } catch (err: any) {
    console.error('Test Case 2: FAILED with error:', err.message);
    success = false;
  }

  // Test Case 3: Construction Prompt
  try {
    console.log('\nTest Case 3: Construction Prompt ("Necesito cemento y ladrillos para levantar una pared")');
    const result = await generateQuodomFromPrompt('Necesito cemento y ladrillos para levantar una pared', 'dummy-user-id');
    console.log('Result:', JSON.stringify(result, null, 2));

    if (!result.title.includes('Construcción IA')) {
      throw new Error(`Title expected to contain "Construcción IA", got: "${result.title}"`);
    }
    if (result.items.length === 0) {
      throw new Error('Items list is empty');
    }
    console.log('Test Case 3: PASSED');
  } catch (err: any) {
    console.error('Test Case 3: FAILED with error:', err.message);
    success = false;
  }

  // Test Case 4: Generic Keyword Prompt
  try {
    console.log('\nTest Case 4: Generic Keyword Prompt ("Quiero buscar un pincel en la tienda")');
    const result = await generateQuodomFromPrompt('Quiero buscar un pincel en la tienda', 'dummy-user-id');
    console.log('Result:', JSON.stringify(result, null, 2));

    if (!result.title.includes('Generado IA') && !result.title.includes('Pintura IA')) {
      throw new Error(`Title expected to contain category label or "Generado IA", got: "${result.title}"`);
    }
    if (result.items.length === 0) {
      throw new Error('Items list is empty');
    }
    console.log('Test Case 4: PASSED');
  } catch (err: any) {
    console.error('Test Case 4: FAILED with error:', err.message);
    success = false;
  }

  // Test Case 5: Database ID validation check
  try {
    console.log('\nTest Case 5: Verify products exist in SQLite catalog');
    const result = await generateQuodomFromPrompt('Necesito pintar', 'dummy-user-id');
    for (const item of result.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });
      if (!product) {
        throw new Error(`Product with ID ${item.productId} returned by mock fallback does not exist in SQLite dev.db`);
      }
    }
    console.log('Test Case 5: PASSED (All returned product IDs verified in dev.db)');
  } catch (err: any) {
    console.error('Test Case 5: FAILED with error:', err.message);
    success = false;
  }

  // Restore environment variables
  process.env.GEMINI_API_KEY = origGemini;
  process.env.OPENAI_API_KEY = origOpenAI;

  console.log('\n--- VERIFICATION TEST SUMMARY ---');
  if (success) {
    console.log('ALL TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
