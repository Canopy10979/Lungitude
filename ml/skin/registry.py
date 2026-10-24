"""One architecture registry shared by training and model serving."""
ARCHITECTURES = {
    'mobilenet_v3_small': {'output':'output_mobile', 'name':'MobileNetV3', 'batch_size':16},
    'efficientnet_b0': {'output':'output_efficient', 'name':'EfficientNet-B0', 'batch_size':16},
    'vit_b_16': {'output':'output_vit', 'name':'Vision Transformer', 'batch_size':4},
    'resnet18': {'output':'output_resnet', 'name':'ResNet-18', 'batch_size':16},
    'densenet121': {'output':'output_dense', 'name':'DenseNet-121', 'batch_size':8},
    'convnext_tiny': {'output':'output_convnext', 'name':'ConvNeXt-Tiny', 'batch_size':4},
}
