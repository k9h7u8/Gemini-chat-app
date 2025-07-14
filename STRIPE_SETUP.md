# Stripe Integration Setup Guide

This guide explains how to set up Stripe integration for the subscription system.

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...  # Your Stripe secret key (test mode)
STRIPE_WEBHOOK_SECRET=whsec_...  # Webhook endpoint secret
STRIPE_BASIC_PRICE_ID=price_basic_...  # Price ID for Basic subscription
STRIPE_PRO_PRICE_ID=price_pro_...  # Price ID for Pro subscription
```

## Stripe Dashboard Setup

### 1. Create Products and Prices

1. Go to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Products** → **Add Product**
3. Create two products:

#### Basic Subscription
- **Name**: Basic Plan
- **Description**: Basic chat features
- **Pricing**: Set your desired price (e.g., $0/month for free tier)
- **Billing**: Recurring
- **Billing period**: Monthly
- Copy the **Price ID** (starts with `price_`)

#### Pro Subscription
- **Name**: Pro Plan
- **Description**: Advanced chat features with AI
- **Pricing**: Set your desired price (e.g., $9.99/month)
- **Billing**: Recurring
- **Billing period**: Monthly
- Copy the **Price ID** (starts with `price_`)

### 2. Set Up Webhook Endpoint

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to: `https://your-domain.com/subscription/webhook/stripe`
4. Select the following events to listen for:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)

## API Endpoints

### Create Pro Subscription
```http
POST /subscription/subscribe/pro
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "tier": "Pro",
  "successUrl": "https://your-app.com/success",
  "cancelUrl": "https://your-app.com/cancel"
}
```

### Get Subscription Status
```http
GET /subscription/status
Authorization: Bearer <jwt_token>
```

### Stripe Webhook (Internal)
```http
POST /subscription/webhook/stripe
Content-Type: application/json
Stripe-Signature: <stripe_signature>

{
  // Stripe webhook payload
}
```

## Testing

### 1. Test Subscription Creation
```bash
curl -X POST http://localhost:3000/subscription/subscribe/pro \
  -H "Authorization: Bearer <your_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "Pro",
    "successUrl": "https://example.com/success",
    "cancelUrl": "https://example.com/cancel"
  }'
```

### 2. Test Subscription Status
```bash
curl -X GET http://localhost:3000/subscription/status \
  -H "Authorization: Bearer <your_jwt_token>"
```

### 3. Test Webhook (using Stripe CLI)
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/subscription/webhook/stripe

# In another terminal, trigger a test event
stripe trigger checkout.session.completed
```

## Webhook Testing with ngrok

For local development, use ngrok to expose your local server:

```bash
# Install ngrok
npm install -g ngrok

# Start your NestJS server
npm run start:dev

# In another terminal, expose your local server
ngrok http 3000

# Use the ngrok URL in your Stripe webhook endpoint
# Example: https://abc123.ngrok.io/subscription/webhook/stripe
```

## Security Considerations

1. **Webhook Signature Verification**: The application verifies Stripe webhook signatures to prevent replay attacks.
2. **Environment Variables**: Never commit Stripe keys to version control.
3. **HTTPS**: Always use HTTPS in production for webhook endpoints.
4. **Idempotency**: Webhook handlers are designed to be idempotent.

## Error Handling

The application handles various error scenarios:
- Invalid webhook signatures
- Missing user data
- Failed payments (downgrades to Basic)
- Cancelled subscriptions (downgrades to Basic)

## Subscription Flow

1. User requests Pro subscription
2. System creates Stripe checkout session
3. User completes payment on Stripe
4. Stripe sends webhook to `/subscription/webhook/stripe`
5. System updates user's subscription status
6. User can check status via `/subscription/status` 