{
    "data": {
        "products": {
            "items": [
                {
                    "sku": "test1-child-snow",
                    "name": "test1-child-snow",
                    "__typename": "VirtualProduct"
                },
                {
                    "sku": "test1-child-stone",
                    "name": "test1-child-stone",
                    "__typename": "VirtualProduct"
                },
                {
                    "sku": "test1-child-violet",
                    "name": "test1-child-violet",
                    "__typename": "VirtualProduct"
                },
                {
                    "sku": "test1-child-ivory",
                    "name": "test1-child-ivory",
                    "__typename": "VirtualProduct"
                },
                {
                    "sku": "test1-child-white",
                    "name": "test1-child-white",
                    "__typename": "VirtualProduct"
                },
                {
                    "sku": "test1-parent",
                    "name": "test1-parent",
                    "__typename": "ConfigurableProduct",
                    "variants": [
                        {
                            "product": {
                                "sku": "test1-child-white",
                                "name": "test1-child-white",
                                "color": 10,
                                "price_range": {
                                    "maximum_price": {
                                        "regular_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        },
                                        "final_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        }
                                    },
                                    "minimum_price": {
                                        "regular_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        },
                                        "final_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        }
                                    }
                                },
                                "__typename": "SimpleProduct"
                            }
                        },
                        {
                            "product": {
                                "sku": "test1-child-ivory",
                                "name": "test1-child-ivory",
                                "color": 13,
                                "price_range": {
                                    "maximum_price": {
                                        "regular_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        },
                                        "final_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        }
                                    },
                                    "minimum_price": {
                                        "regular_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        },
                                        "final_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        }
                                    }
                                },
                                "__typename": "SimpleProduct"
                            }
                        },
                        {
                            "product": {
                                "sku": "test1-child-violet",
                                "name": "test1-child-violet",
                                "color": 11,
                                "price_range": {
                                    "maximum_price": {
                                        "regular_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        },
                                        "final_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        }
                                    },
                                    "minimum_price": {
                                        "regular_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        },
                                        "final_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        }
                                    }
                                },
                                "__typename": "SimpleProduct"
                            }
                        },
                        {
                            "product": {
                                "sku": "test1-child-stone",
                                "name": "test1-child-stone",
                                "color": 14,
                                "price_range": {
                                    "maximum_price": {
                                        "regular_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        },
                                        "final_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        }
                                    },
                                    "minimum_price": {
                                        "regular_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        },
                                        "final_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        }
                                    }
                                },
                                "__typename": "SimpleProduct"
                            }
                        },
                        {
                            "product": {
                                "sku": "test1-child-snow",
                                "name": "test1-child-snow",
                                "color": 12,
                                "price_range": {
                                    "maximum_price": {
                                        "regular_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        },
                                        "final_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        }
                                    },
                                    "minimum_price": {
                                        "regular_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        },
                                        "final_price": {
                                            "currency": "PLN",
                                            "value": 240
                                        }
                                    }
                                },
                                "__typename": "SimpleProduct"
                            }
                        }
                    ]
                },
                {
                    "sku": "linea-white-78",
                    "name": "LINEA white 78",
                    "__typename": "SimpleProduct"
                },
                {
                    "sku": "test1",
                    "name": "Testowy",
                    "__typename": "SimpleProduct"
                }
            ]
        }
    }
}

NOTE:
PriceRange
Description
Contains the price range for a product. If the product has a single price, the minimum and maximum price will be the same. For Curtain Wizar proce calculations we should use maximum_price/final_price.