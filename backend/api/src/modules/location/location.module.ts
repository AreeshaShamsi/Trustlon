import { Module } from '@nestjs/common';
import { CitySearchService } from './city-search.service';
import { CheckoutPincodeController, CountriesController, LocationController } from './location.controller';
import { PincodeService } from './pincode.service';

@Module({
  controllers: [LocationController, CheckoutPincodeController, CountriesController],
  providers: [PincodeService, CitySearchService],
  exports: [PincodeService],
})
export class LocationModule {}
