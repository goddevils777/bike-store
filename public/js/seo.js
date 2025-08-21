class SeoManager {
    constructor() {
        this.loadSeoData();
    }

    async loadSeoData() {
        try {
            const response = await fetch('/api/seo');
            if (!response.ok) throw new Error('Ошибка загрузки SEO данных');
            
            const seoData = await response.json();
            this.applySeoData(seoData);
        } catch (error) {
            console.error('Ошибка загрузки SEO:', error);
            // Используем дефолтные значения если API недоступен
        }
    }

    applySeoData(data) {
        // Основные мета-теги
        this.updateElement('page-title', data.title);
        this.updateMetaContent('meta-description', data.description);
        this.updateMetaContent('meta-keywords', data.keywords);
        this.updateMetaContent('meta-author', data.author);
        this.updateMetaContent('meta-robots', data.robots);
        this.updateMetaContent('meta-language', data.language);

        // Open Graph
        this.updateMetaContent('og-site-name', data.siteName);
        this.updateMetaContent('og-title', data.ogTitle || data.title);
        this.updateMetaContent('og-description', data.ogDescription || data.description);
        this.updateMetaContent('og-image', data.ogImage);
        this.updateMetaContent('og-url', data.ogUrl);

        // Twitter Cards
        this.updateMetaContent('twitter-card', data.twitterCard);
        this.updateMetaContent('twitter-title', data.twitterTitle || data.title);
        this.updateMetaContent('twitter-description', data.twitterDescription || data.description);
        this.updateMetaContent('twitter-image', data.twitterImage || data.ogImage);

        // Генерируем Schema.org
        if (data.schema) {
            this.generateSchemaMarkup(data.schema);
        }
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element && value) {
            element.textContent = value;
        }
    }

    updateMetaContent(id, value) {
        const element = document.getElementById(id);
        if (element && value) {
            element.setAttribute('content', value);
        }
    }

    generateSchemaMarkup(schema) {
        const schemaData = {
            "@context": "https://schema.org",
            "@type": "Store",
            "name": schema.organizationName,
            "url": schema.organizationUrl,
            "logo": schema.organizationLogo,
            "telephone": schema.contactPhone,
            "email": schema.contactEmail,
            "address": {
                "@type": "PostalAddress",
                "streetAddress": schema.address?.streetAddress,
                "addressLocality": schema.address?.city,
                "addressRegion": schema.address?.region,
                "postalCode": schema.address?.postalCode,
                "addressCountry": schema.address?.country
            },
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "reviewCount": "245"
            },
            "priceRange": "€€",
            "description": document.getElementById('meta-description')?.getAttribute('content')
        };

        // Удаляем существующий schema
        const existingSchema = document.getElementById('schema-markup');
        if (existingSchema) {
            existingSchema.remove();
        }

        // Добавляем новый schema
        const script = document.createElement('script');
        script.id = 'schema-markup';
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(schemaData, null, 2);
        document.head.appendChild(script);
    }

    // Обновление SEO для конкретных товаров
    updateProductSeo(product) {
        if (!product) return;

        const productTitle = `${product.title} - Купить электровелосипед | ReBike Store`;
        const productDescription = `Купить ${product.title} по цене ${product.priceRub}. ${product.description?.substring(0, 120) || 'Качественный электровелосипед с гарантией'}...`;

        this.updateElement('page-title', productTitle);
        this.updateMetaContent('meta-description', productDescription);
        this.updateMetaContent('og-title', productTitle);
        this.updateMetaContent('og-description', productDescription);
        
        if (product.images && product.images.length > 0) {
            this.updateMetaContent('og-image', product.images[0]);
            this.updateMetaContent('twitter-image', product.images[0]);
        }

        // Schema для товара
        this.generateProductSchema(product);
    }

    generateProductSchema(product) {
        const productSchema = {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": product.title,
            "description": product.description || `Электровелосипед ${product.title}`,
            "image": product.images || [],
            "brand": {
                "@type": "Brand",
                "name": "ReBike Store"
            },
            "offers": {
                "@type": "Offer",
                "price": product.currentBasePriceEur,
                "priceCurrency": "EUR",
                "availability": "https://schema.org/InStock",
                "seller": {
                    "@type": "Organization",
                    "name": "ReBike Store"
                }
            },
            "category": product.category,
            "sku": product.id
        };

        const existingProductSchema = document.getElementById('product-schema');
        if (existingProductSchema) {
            existingProductSchema.remove();
        }

        const script = document.createElement('script');
        script.id = 'product-schema';
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(productSchema, null, 2);
        document.head.appendChild(script);
    }
}

// Инициализация SEO
document.addEventListener('DOMContentLoaded', () => {
    window.seoManager = new SeoManager();
});