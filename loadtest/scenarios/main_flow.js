import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8888';

export const options = {
  vus: 1,
  iterations: 1,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const home = http.get(`${BASE_URL}/`, {
    tags: { name: 'home' },
  });

  check(home, {
    'trang chu tra HTTP 200': (res) => res.status === 200,
  });

  sleep(1);

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

  if (!productLink) return;

  const productId = productLink[1];

  const product = http.get(`${BASE_URL}/catalog/${productId}`, {
    tags: { name: 'product_detail' },
  });

  check(product, {
    'chi tiet san pham tra HTTP 200': (res) => res.status === 200,
  });

  const addToCart = http.post(
    `${BASE_URL}/cart`,
    { productId, quantity: '1' },
    { tags: { name: 'add_to_cart' } },
  );

  check(addToCart, {
    'them san pham vao gio': (res) =>
      res.status === 200 && res.body.includes('cart-item'),
  });

  const cart = http.get(`${BASE_URL}/cart`, {
    tags: { name: 'view_cart' },
  });

  check(cart, {
    'gio hang co san pham': (res) =>
      res.status === 200 && res.body.includes('cart-item'),
  });

  const checkout = http.get(`${BASE_URL}/checkout`, {
    tags: { name: 'checkout_shipping_page' },
  });

  check(checkout, {
    'mo duoc trang dia chi giao hang': (res) =>
      res.status === 200 && res.body.includes('checkoutForm'),
  });

  const shipping = http.post(
    `${BASE_URL}/checkout`,
    {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john_doe@example.com',
      address1: '100 Main Street',
      city: 'Anytown',
      state: 'CA',
      zipCode: '11111',
    },
    { tags: { name: 'checkout_shipping' } },
  );

  check(shipping, {
    'gui dia chi va mo duoc trang giao hang': (res) =>
      res.status === 200 && res.body.includes('type="radio"'),
  });

  const tokenMatch = shipping.body.match(
    /type="radio"[^>]*value="([^"]+)"/i,
  );

  check(tokenMatch, {
    'tim thay token giao hang': (match) => match !== null,
  });

  if (!tokenMatch) return;

  const delivery = http.post(
    `${BASE_URL}/checkout/delivery`,
    { token: tokenMatch[1] },
    { tags: { name: 'checkout_delivery' } },
  );

  check(delivery, {
    'chon duoc giao hang va mo trang thanh toan': (res) =>
      res.status === 200 && res.body.includes('name="cardNumber"'),
  });

  const payment = http.post(
    `${BASE_URL}/checkout/payment`,
    {
      cardHolder: 'John Doe',
      cardNumber: '1234567890123456',
      expiryDate: '01/35',
      cvc: '123',
    },
    { tags: { name: 'checkout_payment' } },
  );

  check(payment, {
    'tao duoc don demo local': (res) =>
      res.status === 200 && res.body.includes('Order placed'),
  });
}