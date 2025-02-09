# Use Node.js LTS as base image
FROM mcr.microsoft.com/devcontainers/javascript-node:lts

# Install basic development tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Set default shell to bash
ENV SHELL /bin/bash 