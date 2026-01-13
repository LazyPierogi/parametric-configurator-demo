import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { PriceQuote, ServiceOption } from '@curtain-wizard/core/src/catalog';

export interface ServicesSectionProps {
  t: (key: string, params?: Record<string, any>) => string;
  formatCurrency: (minor: number, currency: string, locale: string) => string;
  serviceOptions: ServiceOption[];
  selectedServices: string[];
  toggleService: (id: string) => void;
  quote: PriceQuote | null;
  providerId: string | null;
  locale: string;
  onOpenConsultation: (url: string) => void;
}

export function ServicesSection({
  t,
  formatCurrency,
  serviceOptions,
  selectedServices,
  toggleService,
  quote,
  providerId,
  locale,
  onOpenConsultation,
}: ServicesSectionProps) {
  return (
    <div className="mb-[18px]">
      <div className="panel-heading">{t('configure.panel.services')}</div>
      <div className="flex flex-col gap-2">
        {serviceOptions.map((svc) => {
          const selected = selectedServices.includes(svc.id);
          const currency = svc.currency ?? quote?.currency ?? 'PLN';
          const priceLabel =
            svc.priceMinor && svc.priceMinor > 0
              ? formatCurrency(svc.priceMinor, currency, locale)
              : t('configure.serviceIncluded');
          const displayLabel = providerId === 'mock' ? t(`configure.services.catalog.${svc.id}.label`) : svc.label;
          const displayDesc =
            providerId === 'mock' ? t(`configure.services.catalog.${svc.id}.description`) : svc.description;

          return (
            <label key={svc.id} className="block cursor-pointer">
              <Card variant="selectable" selected={selected} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="cw-checkbox mr-2"
                  checked={selected}
                  onChange={() => toggleService(svc.id)}
                />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex justify-between gap-2 font-semibold">
                    <span>{displayLabel}</span>
                    <span>{priceLabel}</span>
                  </div>
                  {displayDesc && <div className="text-[11px] text-neutral-600">{displayDesc}</div>}
                  {svc.externalLink && (
                    <div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="px-2.5 py-1 text-[11px]"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onOpenConsultation(svc.externalLink!);
                        }}
                      >
                        {t('configure.services.bookConsultation')}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </label>
          );
        })}
      </div>
    </div>
  );
}
