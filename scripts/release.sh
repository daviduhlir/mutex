#!/bin/bash

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "master" ]]; then
  echo 'Release is allowed only from master';
  exit 1;
fi

if [[ `git status --porcelain` ]]; then
  echo 'Working directory is not clean';
  exit 1;
fi

npm run build
npm test
npm version patch
tag=$(git tag --points-at HEAD)
git add --all
git push origin master --tags
npm publish --access public
