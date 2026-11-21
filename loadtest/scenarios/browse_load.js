import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8888';

export const options = {
  stages: [
    { duration: '10s', target: 1 },
    { duration: '30s', target: 1 },
    { duration: '10s', target: 5 },
    { duration: '30s', target: 5 },
    { duration: '10s', target: 10 },
    { duration: '30s', target: 10 },
    { duration: '10s', target: 0 },
  ],
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const catalog = http.get(`${BASE_URL}/catalog?page=1&size=6`, {
    tags: { name: 'catalog' },
  });

  check(catalog, {
    'danh muc tra HTTP 200': (res) => res.status === 200,
    'danh muc co san pham': (res) => res.body.includes('product-card'),
  });

  const productLink = catalog.body.match(/href="\/catalog\/([^"/?]+)"/);

  check(productLink, {
    'tim thay link san pham': (match) => match !== null,
  });

  if (productLink) {
    const product = http.get(`${BASE_URL}/catalog/${productLink[1]}`, {
      tags: { name: 'product_detail' },
    });

    check(product, {
      'chi tiet san pham tra HTTP 200': (res) => res.status === 200,
    });
  }

  sleep(1);
}