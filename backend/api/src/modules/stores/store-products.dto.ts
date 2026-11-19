import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PageQueryDto } from '../../common/http/pagination';

const sorts = ['relevance', 'popularity', 'price_asc', 'price_desc', 'newest', 'rating'] as const;

export class StoreProductQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPricePaise?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPricePaise?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value : undefined))
  @IsIn(sorts)
  sort: (typeof sorts)[number] = 'relevance';
}
