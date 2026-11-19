import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV === 'production') throw new Error('The development tax backfill must never run in production.');

const prisma = new PrismaClient();
const rateFor = (name: string) => /grocery|coffee|fashion|footwear|travel|bag/i.test(name) ? 500 : /electronics|audio|watch|computer/i.test(name) ? 1800 : 1800;

async function main() {
  const products = await prisma.product.findMany({ where: { OR: [{ hsnCode: null }, { gstRateBps: null }] }, include: { category: true } });
  for (const product of products) {
    await prisma.product.update({ where: { id: product.id }, data: { hsnCode: product.hsnCode ?? product.category.defaultHsn ?? '9999', gstRateBps: product.gstRateBps ?? rateFor(product.category.name) } });
  }
  console.log(`DEV tax backfill updated ${products.length} products.`);
}

main().finally(() => prisma.$disconnect());
