import { BadRequestException, Controller, Delete, Get, Header, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { OptionalJwtAuthGuard } from '../../common/auth/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { LocalQueryDto } from './dto';
import { StoreProductQueryDto } from './store-products.dto';
import { StoresService } from './stores.service';

@Controller()
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  /** `featured=true` for the home page section; otherwise all verified stores. */
  @Get('stores')
  @Header('Cache-Control', 'public, max-age=300')
  async list(@Query('featured') featured?: string) {
    return {
      items: featured === 'true' ? await this.stores.featured() : await this.stores.verified(),
    };
  }

  /** Brand Store header. Products come from GET /products?store=<slug>. */
  @Get('stores/:slug')
  @Header('Cache-Control', 'public, max-age=300')
  @UseGuards(OptionalJwtAuthGuard)
  store(@Param('slug') slug: string, @Req() request: Request & { user?: AuthUser }) {
    return this.stores.bySlug(slug, request.user?.id);
  }

  @Get('stores/:slug/products')
  @Header('Cache-Control', 'public, max-age=60')
  products(@Param('slug') slug: string, @Query() query: StoreProductQueryDto) {
    return this.stores.productsForStore(slug, query);
  }

  @Post('stores/:slug/follow')
  @UseGuards(JwtAuthGuard)
  follow(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    return this.stores.follow(slug, user.id);
  }

  @Delete('stores/:slug/follow')
  @UseGuards(JwtAuthGuard)
  unfollow(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    return this.stores.unfollow(slug, user.id);
  }

  @Get('local/sellers')
  @Header('Cache-Control', 'public, max-age=0, must-revalidate')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  localSellers(@Query() query: LocalQueryDto) {
    return this.stores.localSellers(query.pincode, this.radius(query), query.page, query.pageSize);
  }

  @Get('local/products')
  @Header('Cache-Control', 'public, max-age=0, must-revalidate')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async localProducts(@Query() query: LocalQueryDto) {
    return this.stores.localProducts(query.pincode, this.radius(query), query.page, query.pageSize);
  }

  private radius(query: LocalQueryDto) {
    if (
      query.radius !== undefined &&
      query.radiusKm !== undefined &&
      query.radius !== query.radiusKm
    ) {
      throw new BadRequestException('radius and radiusKm must agree');
    }
    return query.radius ?? query.radiusKm ?? 10;
  }
}
