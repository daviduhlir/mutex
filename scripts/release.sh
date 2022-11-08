#!/bin/bash

npm run build
npm test
npm version patch
tag=$(git tag --points-at HEAD)
git push origin "$tag"
npm publish --access public
