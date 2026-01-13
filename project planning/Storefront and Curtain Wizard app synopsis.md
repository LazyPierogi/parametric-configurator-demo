# app synopsis

1. Platforms: responsive web app (mobile first) working great on PC, Mac and standard iOS/Android resolutions.
2. visual style: TBD (modern, sleek, minimalistic, responsive, informative)
3. app components:
    1. Storefront ecommerce app based on Magento solution (**a separate app, not to be developed within Curtain Wizard!!!**)
        1. presentation of products:
        2. product database and descriptions
        3. product and installation informations
        4. links to wizard app
        5. about us
        6. user account, basket, shop, payment, order tracking, components
    2. Curtain Wizard app (connected to storefront ecomerce via container). Flow:
        1. user uploads/takes a picture of their wall with their phone (with reference A4 paper sheet)
        2. AI model #1 (e.g. gemini-flash-lite-001 or other model) measuers opposite wall using reference A4 sheet
        3. AI model #2 (most likely local server with facebook mask2former) will segment uploaded picture to create transparent wall mask (in order to render curtains on appropriate layer)
        4. (prompt on mobile only = “tilt your phone horizontally”) user selects 4 corners of the wall and confirms that points are properly aligned
        5. default curtain (or curtain selected from storefront product page) is rendered via code in two segments:
            1. layer 0 - uploaded photo
            2. layer 1 - rendered curtains
            3. layer 3 - wall mask from AI model #2
        6. user can manually drag&drop curtains and scale ther size or move position or choose more segments
        7. user can select different curtain types (materials, patterns, colors etc). Their prices and other characteristics (colors, materials, patterns, dimensions etc) will be fetched from the Storefront app using SKU queries as described here: [https://developer.adobe.com/commerce/webapi/graphql/schema/products/queries/products](https://developer.adobe.com/commerce/webapi/graphql/schema/products/queries/products)
        8. price is instantly calculated based on user choices and curtains can be added to basket (integrated with the storefront)
        9. user can continue or proceed to a checkout.